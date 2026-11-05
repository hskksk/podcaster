import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { loadConfig } from "../../_shared/config.ts";
import { storeBlob } from "../../_adapters/storage.ts";
import { recordLlmInvocation } from "../job-db.ts";
import { resolveProfile } from "../runner.ts";
import type { JobHandler, RenderAudioInput } from "../types.ts";
import { appendAudioTranscodeSubmitted } from "../transcode-domain-events.ts";
import {
  assertGcpRunConfig,
  isCloudRunExecutionName,
  isGeminiBatchOperationName,
  isTranscodeEnabled,
} from "../../_shared/transcode/config.ts";
import {
  isRetryableCloudRunSubmitError,
  submitCloudRunTranscode,
} from "../../_shared/transcode/cloud-run.ts";
import {
  finalizeTranscodedAudioBlob,
  loadEpisodeIdForJob,
} from "../../_shared/transcode/finalize.ts";
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

async function beginTranscodeAfterWav(
  ctx: Parameters<JobHandler>[0],
  wav: { blobId: string; storagePath: string },
  batchMeta: Record<string, unknown>,
  casting: unknown,
  chunkCount: number,
  externalId: string | null,
  ttsModel: string,
  fetchedChunkCount: number,
): Promise<
  | { outcome: "succeeded"; waitingExternal: true }
  | { outcome: "retryable"; errorMessage: string }
> {
  const cfg = await loadConfig();
  const scriptId = String((ctx.job.input as RenderAudioInput).script_id ?? "").trim();
  const episodeId = await loadEpisodeIdForJob(ctx.db, ctx.job);
  const prior = (ctx.job.output ?? {}) as Record<string, unknown>;
  const existingTranscode = (prior.transcode ?? {}) as Record<string, unknown>;
  const existingExecution = String(existingTranscode?.execution ?? "").trim();

  let executionName = existingExecution;
  let outputStoragePath = String(existingTranscode?.output_storage_path ?? "").trim();
  const newlySubmitted = !executionName;

  if (!executionName) {
    let submitted: Awaited<ReturnType<typeof submitCloudRunTranscode>>;
    try {
      submitted = await submitCloudRunTranscode({
        db: ctx.db,
        cfg,
        jobId: ctx.job.id,
        attemptId: ctx.attemptId,
        episodeId,
        wavStoragePath: wav.storagePath,
      });
    } catch (err) {
      if (isRetryableCloudRunSubmitError(err)) {
        return {
          outcome: "retryable",
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
      throw err;
    }
    executionName = submitted.executionName;
    outputStoragePath = submitted.outputStoragePath;

    const { error: insertErr } = await ctx.db.schema("jobs").from("external_operations").insert({
      attempt_id: ctx.attemptId,
      operation_name: executionName,
      state: "EXECUTION_RUNNING",
      next_poll_at: new Date(Date.now() + 30_000).toISOString(),
    });
    if (insertErr) throw new Error(`external_operations transcode insert: ${insertErr.message}`);
  }

  const nextOutput = {
    ...prior,
    batch: batchMeta,
    script_id: scriptId,
    wav_blob_id: wav.blobId,
    wav_storage_path: wav.storagePath,
    casting,
    chunk_count: chunkCount,
    transcode: {
      execution: executionName,
      wav_blob_id: wav.blobId,
      wav_storage_path: wav.storagePath,
      output_storage_path: outputStoragePath,
      ready_to_finalize: false,
    },
  };

  const { error: updateErr } = await ctx.db.schema("jobs").from("jobs").update({
    output: nextOutput,
  }).eq("id", ctx.job.id);
  if (updateErr) throw new Error(`persist transcode phase: ${updateErr.message}`);

  if (newlySubmitted) {
    try {
      await appendAudioTranscodeSubmitted(ctx.db, ctx.job, {
        job_id: ctx.job.id,
        script_id: scriptId,
        wav_blob_id: wav.blobId,
        wav_storage_path: wav.storagePath,
        output_storage_path: outputStoragePath,
        execution_name: executionName,
      });
    } catch (err) {
      console.warn("[render_audio] AudioTranscodeSubmitted append failed", ctx.job.id, err);
    }
  }

  if (externalId && prior.llm_invocations_recorded !== true) {
    for (let i = 0; i < fetchedChunkCount; i++) {
      await recordLlmInvocation(ctx.db, {
        attempt_id: ctx.attemptId,
        external_operation_id: externalId,
        item_index: i,
        model: ttsModel,
        finish_reason: "stop",
      });
    }
    await ctx.db.schema("jobs").from("jobs").update({
      output: { ...nextOutput, llm_invocations_recorded: true },
    }).eq("id", ctx.job.id);
  }

  return { outcome: "succeeded", waitingExternal: true };
}

function transcodeMetaFrom(meta: Record<string, unknown>): Record<string, unknown> | undefined {
  return meta.transcode as Record<string, unknown> | undefined;
}

export const handleRenderAudio: JobHandler = async (ctx) => {
  const input = ctx.job.input as RenderAudioInput;
  const scriptId = String(input.script_id ?? "").trim();
  const scriptContent = String(input.script_content ?? "").trim();
  if (!scriptId || !scriptContent) {
    throw new Error("render_audio requires script_id and script_content");
  }

  const profile = await resolveProfile(input.profile as Record<string, unknown> | undefined);
  const cfg = await loadConfig();
  const ttsModel = String(profile["tts.model"] || "gemini-3.1-flash-tts-preview");
  const meta = (ctx.job.output ?? {}) as Record<string, unknown>;
  const batchMeta = (meta.batch ?? {}) as Record<string, unknown>;
  const transcodeMeta = transcodeMetaFrom(meta) ?? {};
  const apiRoot = String(batchMeta.apiRoot ?? profile["gemini.api_root"] ?? "");
  const wavBlobId = String(meta.wav_blob_id ?? "").trim();
  const wavStoragePath = String(meta.wav_storage_path ?? "").trim();

  if (transcodeMeta.finalized === true || meta.mime_type === "audio/mp4") {
    return {
      outcome: "succeeded",
      output: meta as Record<string, unknown>,
    };
  }

  if (transcodeMeta.ready_to_finalize === true) {
    const output = await finalizeTranscodedAudioBlob({
      db: ctx.db,
      job: ctx.job,
      attemptId: ctx.attemptId,
      cfg,
      transcode: transcodeMeta,
    });
    return { outcome: "succeeded", output };
  }

  if (
    isTranscodeEnabled(cfg) &&
    wavStoragePath &&
    wavBlobId &&
    !String(transcodeMeta.execution ?? "").trim()
  ) {
    const batchExternalId = String(meta.batch_external_id ?? "").trim();
    if (batchExternalId) {
      await ctx.db.schema("jobs").from("external_operations").update({
        completed_at: new Date().toISOString(),
      }).eq("id", batchExternalId).is("completed_at", null);
    }
    return beginTranscodeAfterWav(
      ctx,
      { blobId: wavBlobId, storagePath: wavStoragePath },
      batchMeta,
      meta.casting ?? batchMeta.casting ?? {},
      Number(meta.chunk_count ?? batchMeta.requestCount ?? 0),
      batchExternalId || null,
      ttsModel,
      Number(meta.chunk_count ?? batchMeta.requestCount ?? 0),
    );
  }

  let external = await loadLatestExternalOp(ctx.db, ctx.job.id);

  if (external && isCloudRunExecutionName(external.operation_name)) {
    return { outcome: "succeeded", waitingExternal: true };
  }

  if (
    !external &&
    ctx.job.status !== "waiting_external" &&
    wavStoragePath &&
    wavBlobId &&
    !isTranscodeEnabled(cfg)
  ) {
    const { data: blob, error: blobErr } = await ctx.db
      .schema("podcast")
      .from("blobs")
      .select("byte_size, mime_type")
      .eq("id", wavBlobId)
      .maybeSingle();
    if (blobErr) throw new Error(`render_audio wav blob lookup: ${blobErr.message}`);
    return {
      outcome: "succeeded",
      output: {
        script_id: scriptId,
        blob_id: wavBlobId,
        storage_path: wavStoragePath,
        mime_type: "audio/wav",
        byte_size: Number(blob?.byte_size ?? meta.byte_size ?? 0),
        duration_ms: null,
        casting: meta.casting ?? batchMeta.casting ?? {},
        chunk_count: Number(meta.chunk_count ?? batchMeta.requestCount ?? 0),
      },
    };
  }

  if (!external && ctx.job.status !== "waiting_external") {
    if (isTranscodeEnabled(cfg) && wavStoragePath && wavBlobId) {
      return beginTranscodeAfterWav(
        ctx,
        { blobId: wavBlobId, storagePath: wavStoragePath },
        batchMeta,
        meta.casting ?? batchMeta.casting ?? {},
        Number(meta.chunk_count ?? 0),
        String(meta.batch_external_id ?? "").trim() || null,
        ttsModel,
        Number(meta.chunk_count ?? 0),
      );
    }

    if (isTranscodeEnabled(cfg)) {
      assertGcpRunConfig();
      if (!Deno.env.get("GCP_SERVICE_ACCOUNT_JSON")?.trim()) {
        throw new Error("GCP_SERVICE_ACCOUNT_JSON is required when audio transcode is enabled");
      }
    }

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

  if (!isGeminiBatchOperationName(external.operation_name)) {
    throw new Error(`render_audio: unsupported external operation ${external.operation_name}`);
  }

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

  const casting = batchMeta.casting ?? {};
  const phaseOutput = {
    ...meta,
    batch: batchMeta,
    script_id: scriptId,
    wav_blob_id: stored.blobId,
    wav_storage_path: stored.storagePath,
    batch_external_id: external.id,
    casting,
    chunk_count: fetched.chunkCount,
  };

  const { error: phaseErr } = await ctx.db.schema("jobs").from("jobs").update({
    output: phaseOutput,
  }).eq("id", ctx.job.id);
  if (phaseErr) throw new Error(`persist wav phase: ${phaseErr.message}`);

  await ctx.db.schema("jobs").from("external_operations").update({
    completed_at: new Date().toISOString(),
    state,
  }).eq("id", external.id);

  if (isTranscodeEnabled(cfg)) {
    return beginTranscodeAfterWav(
      ctx,
      { blobId: stored.blobId, storagePath: stored.storagePath },
      batchMeta,
      casting,
      fetched.chunkCount,
      external.id,
      ttsModel,
      fetched.chunkCount,
    );
  }

  for (let i = 0; i < fetched.chunkCount; i++) {
    await recordLlmInvocation(ctx.db, {
      attempt_id: ctx.attemptId,
      external_operation_id: external.id,
      item_index: i,
      model: ttsModel,
      finish_reason: "stop",
    });
  }

  return {
    outcome: "succeeded",
    output: {
      script_id: scriptId,
      blob_id: stored.blobId,
      storage_path: stored.storagePath,
      mime_type: stored.mimeType,
      byte_size: stored.byteSize,
      duration_ms: null,
      casting,
      chunk_count: fetched.chunkCount,
    },
  };
};
