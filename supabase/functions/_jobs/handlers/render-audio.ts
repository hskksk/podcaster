import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { storeBlob } from "../../_adapters/storage.ts";
import { recordLlmInvocation } from "../job-db.ts";
import { resolveProfile } from "../runner.ts";
import type { JobHandler, RenderAudioInput } from "../types.ts";
import {
  AUDIO_BATCH_FAILURE_STATES,
  AUDIO_BATCH_PENDING_STATES,
  AUDIO_BATCH_SUCCESS_STATES,
  downloadBatchWav,
  pollBatch,
  submitAudioBatch,
} from "./audio-batch.ts";

async function loadLatestExternalOp(
  db: SupabaseClient,
  jobId: string,
): Promise<{
  id: string;
  operation_name: string;
  state: string;
  poll_count: number;
  attempt_id: string;
} | null> {
  const { data: attempts, error: attErr } = await db
    .schema("jobs")
    .from("job_attempts")
    .select("id")
    .eq("job_id", jobId);
  if (attErr) throw new Error(`loadLatestExternalOp attempts: ${attErr.message}`);
  const attemptIds = (attempts ?? []).map((a) => a.id as string);
  if (attemptIds.length === 0) return null;

  const { data, error } = await db
    .schema("jobs")
    .from("external_operations")
    .select("id, operation_name, state, poll_count, attempt_id")
    .in("attempt_id", attemptIds)
    .is("completed_at", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`loadLatestExternalOp: ${error.message}`);
  return data as {
    id: string;
    operation_name: string;
    state: string;
    poll_count: number;
    attempt_id: string;
  } | null;
}

export const handleRenderAudio: JobHandler = async (ctx) => {
  const input = ctx.job.input as RenderAudioInput;
  const scriptId = String(input.script_id ?? "").trim();
  const scriptContent = String(input.script_content ?? "").trim();
  if (!scriptId || !scriptContent) {
    throw new Error("render_audio requires script_id and script_content");
  }

  const profile = await resolveProfile(input.profile as Record<string, unknown> | undefined);
  const ttsModel = String(profile["tts.model"] || "gemini-3.1-flash-tts-preview");
  const meta = (ctx.job.output ?? {}) as Record<string, unknown>;
  const batchMeta = (meta.batch ?? {}) as Record<string, unknown>;
  const apiRoot = String(batchMeta.apiRoot ?? profile["gemini.api_root"] ?? "");

  let external = await loadLatestExternalOp(ctx.db, ctx.job.id);

  if (!external && ctx.job.status !== "waiting_external") {
    const submitted = await submitAudioBatch({
      profile,
      scriptId,
      scriptContent,
      jobId: ctx.job.id,
    });
    const { error: insertErr } = await ctx.db.schema("jobs").from("external_operations").insert({
      attempt_id: ctx.attemptId,
      operation_name: submitted.batchName,
      state: "JOB_STATE_RUNNING",
      next_poll_at: new Date(Date.now() + 30_000).toISOString(),
    });
    if (insertErr) throw new Error(`external_operations insert: ${insertErr.message}`);

    await ctx.db.schema("jobs").from("jobs").update({
      output: {
        batch: {
          batchName: submitted.batchName,
          apiRoot: submitted.apiRoot,
          requestCount: submitted.requestCount,
          casting: submitted.casting,
        },
      },
    }).eq("id", ctx.job.id);

    return { outcome: "succeeded", waitingExternal: true };
  }

  external = external ?? await loadLatestExternalOp(ctx.db, ctx.job.id);
  if (!external) throw new Error("render_audio: missing external operation");

  const batchName = external.operation_name;
  const resolvedApiRoot = String(batchMeta.apiRoot ?? apiRoot);
  const { status, state } = await pollBatch(batchName, resolvedApiRoot, ttsModel);

  await ctx.db.schema("jobs").from("external_operations").update({
    state,
    poll_count: external.poll_count + 1,
    next_poll_at: new Date(Date.now() + 30_000).toISOString(),
  }).eq("id", external.id);

  if (AUDIO_BATCH_PENDING_STATES.has(state)) {
    return { outcome: "succeeded", waitingExternal: true };
  }

  if (AUDIO_BATCH_FAILURE_STATES.has(state)) {
    await ctx.db.schema("jobs").from("external_operations").update({
      completed_at: new Date().toISOString(),
    }).eq("id", external.id);
    return {
      outcome: "terminal",
      errorMessage: String(status.error ?? state),
    };
  }

  if (!AUDIO_BATCH_SUCCESS_STATES.has(state)) {
    return { outcome: "retryable", errorMessage: `Unexpected batch state: ${state}` };
  }

  const wavTempPath = `/tmp/podcaster-job-${ctx.job.id}-${crypto.randomUUID()}.wav`;
  const expectedCount = typeof batchMeta.requestCount === "number"
    ? batchMeta.requestCount
    : undefined;
  const fetched = await downloadBatchWav({
    batchName,
    apiRoot: resolvedApiRoot,
    ttsModel,
    expectedCount,
    outPath: wavTempPath,
  });

  const wavBytes = await Deno.readFile(wavTempPath);
  await Deno.remove(wavTempPath).catch(() => undefined);

  const stored = await storeBlob(ctx.db, {
    jobId: ctx.job.id,
    attemptId: ctx.attemptId,
    bytes: wavBytes,
    mimeType: "audio/wav",
    fileName: "audio.wav",
  });

  for (let i = 0; i < fetched.chunkCount; i++) {
    await recordLlmInvocation(ctx.db, {
      attempt_id: ctx.attemptId,
      external_operation_id: external.id,
      item_index: i,
      model: ttsModel,
      finish_reason: "stop",
    });
  }

  await ctx.db.schema("jobs").from("external_operations").update({
    completed_at: new Date().toISOString(),
    state,
  }).eq("id", external.id);

  const casting = batchMeta.casting ?? {};
  return {
    outcome: "succeeded",
    output: {
      script_id: scriptId,
      blob_id: stored.blobId,
      storage_path: stored.storagePath,
      mime_type: stored.mimeType,
      duration_ms: null,
      casting,
      chunk_count: fetched.chunkCount,
    },
  };
};
