import { createSupabaseClient } from "../_shared/db.ts";
import { startRunJobFlow } from "../_adapters/pgflow.ts";
import { resolveGeminiApiRoot } from "../_adapters/gemini/endpoint.ts";
import {
  AUDIO_BATCH_FAILURE_STATES,
  AUDIO_BATCH_PENDING_STATES,
  AUDIO_BATCH_SUCCESS_STATES,
  pollBatch,
} from "../_jobs/handlers/audio-batch.ts";
import { loadConfig } from "../_shared/config.ts";
import type { PodcastConfigMap } from "../_shared/types.ts";
import { isCloudRunExecutionName } from "../_shared/transcode/config.ts";
import {
  CLOUD_RUN_FAILURE_STATES,
  CLOUD_RUN_PENDING_STATES,
  CLOUD_RUN_SUCCESS_STATES,
  pollCloudRunExecution,
} from "../_shared/transcode/cloud-run.ts";

const MAX_OPS = 20;

async function resumeJobAfterExternalSuccess(
  db: ReturnType<typeof createSupabaseClient>,
  jobId: string,
  outputPatch?: Record<string, unknown>,
): Promise<void> {
  if (outputPatch) {
    const { data: job } = await db.schema("jobs").from("jobs").select("output").eq("id", jobId)
      .maybeSingle();
    const merged = { ...((job?.output ?? {}) as Record<string, unknown>), ...outputPatch };
    await db.schema("jobs").from("jobs").update({ status: "running", output: merged }).eq(
      "id",
      jobId,
    );
  } else {
    await db.schema("jobs").from("jobs").update({ status: "running" }).eq("id", jobId);
  }
  await startRunJobFlow(db, jobId);
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return Response.json({ ok: true, service: "external-operation-poller" });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const db = createSupabaseClient();
  const startedAt = Date.now();
  const cfg = await loadConfig();
  const ttsModel = String(cfg["tts.model"] || "gemini-3.1-flash-tts-preview");
  const defaultApiRoot = resolveGeminiApiRoot(cfg as PodcastConfigMap);

  const { data: ops, error: listErr } = await db
    .schema("jobs")
    .from("external_operations")
    .select("id, attempt_id, operation_name, state, poll_count")
    .is("completed_at", null)
    .lte("next_poll_at", new Date().toISOString())
    .order("next_poll_at", { ascending: true })
    .limit(MAX_OPS);

  if (listErr) {
    console.error("[external-operation-poller] list failed", listErr);
    return Response.json({ ok: false, error: listErr.message }, { status: 500 });
  }

  let resumed = 0;
  let polled = 0;

  for (const row of ops ?? []) {
    try {
      const { data: attempt, error: attErr } = await db
        .schema("jobs")
        .from("job_attempts")
        .select("job_id")
        .eq("id", row.attempt_id)
        .maybeSingle();
      if (attErr || !attempt) continue;

      const { data: job, error: jobErr } = await db
        .schema("jobs")
        .from("jobs")
        .select("id, status, output")
        .eq("id", attempt.job_id)
        .maybeSingle();
      if (jobErr || !job) continue;

      if (isCloudRunExecutionName(row.operation_name)) {
        const { state } = await pollCloudRunExecution(row.operation_name);
        polled++;
        await db.schema("jobs").from("external_operations").update({
          state,
          poll_count: (row.poll_count ?? 0) + 1,
          next_poll_at: new Date(Date.now() + 30_000).toISOString(),
        }).eq("id", row.id);

        if (CLOUD_RUN_PENDING_STATES.has(state)) continue;

        if (CLOUD_RUN_FAILURE_STATES.has(state)) {
          await db.schema("jobs").from("external_operations").update({
            completed_at: new Date().toISOString(),
          }).eq("id", row.id);
          await db.schema("jobs").from("jobs").update({
            status: "failed",
            finished_at: new Date().toISOString(),
          }).eq("id", job.id);
          continue;
        }

        if (CLOUD_RUN_SUCCESS_STATES.has(state) && job.status === "waiting_external") {
          await db.schema("jobs").from("external_operations").update({
            completed_at: new Date().toISOString(),
            state,
          }).eq("id", row.id);
          const jobOutput = (job.output ?? {}) as Record<string, unknown>;
          const transcode = (jobOutput.transcode ?? {}) as Record<string, unknown>;
          await resumeJobAfterExternalSuccess(db, job.id, {
            transcode: { ...transcode, ready_to_finalize: true },
          });
          resumed++;
        }
        continue;
      }

      const batchMeta = ((job.output as Record<string, unknown> | null)?.batch ??
        {}) as Record<string, unknown>;
      const apiRoot = String(batchMeta.apiRoot ?? cfg["gemini.api_root"] ?? defaultApiRoot);

      const { state } = await pollBatch(row.operation_name, apiRoot, ttsModel);
      polled++;
      await db.schema("jobs").from("external_operations").update({
        state,
        poll_count: (row.poll_count ?? 0) + 1,
        next_poll_at: new Date(Date.now() + 30_000).toISOString(),
      }).eq("id", row.id);

      if (AUDIO_BATCH_PENDING_STATES.has(state)) continue;

      if (AUDIO_BATCH_FAILURE_STATES.has(state)) {
        await db.schema("jobs").from("external_operations").update({
          completed_at: new Date().toISOString(),
        }).eq("id", row.id);
        await db.schema("jobs").from("jobs").update({
          status: "failed",
          finished_at: new Date().toISOString(),
        }).eq("id", job.id);
        continue;
      }

      if (AUDIO_BATCH_SUCCESS_STATES.has(state) && job.status === "waiting_external") {
        await resumeJobAfterExternalSuccess(db, job.id);
        resumed++;
      }
    } catch (err) {
      console.error("[external-operation-poller] op failed", row.id, err);
    }
  }

  return Response.json({
    ok: true,
    scanned: ops?.length ?? 0,
    polled,
    resumed,
    durationMs: Date.now() - startedAt,
  });
});
