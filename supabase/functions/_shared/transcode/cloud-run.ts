import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { PodcastConfigMap } from "../types.ts";
import { assertGcpRunConfig, isCloudRunExecutionName, transcodeBitrateKbps } from "./config.ts";
import { gcpFetch } from "./gcp-token.ts";
import {
  createSignedDownloadUrl,
  createSignedUploadUrl,
} from "./signed-urls.ts";

export interface SubmitTranscodeParams {
  db: SupabaseClient;
  cfg: PodcastConfigMap;
  jobId: string;
  attemptId: string;
  episodeId: string;
  wavStoragePath: string;
}

export interface SubmitTranscodeResult {
  executionName: string;
  outputStoragePath: string;
  wavStoragePath: string;
}

export async function submitCloudRunTranscode(
  params: SubmitTranscodeParams,
): Promise<SubmitTranscodeResult> {
  const { db, cfg, jobId, attemptId, episodeId, wavStoragePath } = params;
  const gcp = assertGcpRunConfig();
  const outputStoragePath = `audio/${episodeId}/${jobId}.m4a`;
  const inputUrl = await createSignedDownloadUrl(db, wavStoragePath);
  const outputUrl = await createSignedUploadUrl(db, outputStoragePath, "audio/mp4");
  const bitrate = transcodeBitrateKbps(cfg);

  const parent =
    `projects/${gcp.projectId}/locations/${gcp.region}/jobs/${gcp.jobName}`;
  const res = await gcpFetch(`${parent}:run`, {
    method: "POST",
    body: JSON.stringify({
      overrides: {
        containerOverrides: [{
          env: [
            { name: "INPUT_URL", value: inputUrl },
            { name: "OUTPUT_UPLOAD_URL", value: outputUrl },
            { name: "OUTPUT_OBJECT_PATH", value: outputStoragePath },
            { name: "BITRATE_KBPS", value: String(bitrate) },
            { name: "JOB_ID", value: jobId },
            { name: "ATTEMPT_ID", value: attemptId },
          ],
        }],
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Cloud Run Job run failed: ${res.status} ${await res.text()}`);
  }
  // jobs:run returns a longrunning Operation; the Execution is in metadata.name.
  const body = await res.json() as {
    name?: string;
    metadata?: { name?: string };
    response?: { name?: string };
  };
  const executionName = String(body.metadata?.name ?? body.response?.name ?? "").trim();
  if (!isCloudRunExecutionName(executionName)) {
    throw new Error(
      `Cloud Run Job run returned no execution name (operation=${body.name ?? "(none)"}, execution=${executionName || "(empty)"})`,
    );
  }

  return { executionName, outputStoragePath, wavStoragePath };
}

export const CLOUD_RUN_PENDING_STATES = new Set([
  "EXECUTION_PENDING",
  "EXECUTION_RUNNING",
  "CONDITION_RECONCILING",
  "EXECUTION_ACTIVE",
]);

export const CLOUD_RUN_SUCCESS_STATES = new Set([
  "EXECUTION_SUCCEEDED",
  "CONDITION_SUCCEEDED",
]);

export const CLOUD_RUN_FAILURE_STATES = new Set([
  "EXECUTION_FAILED",
  "CONDITION_FAILED",
  "EXECUTION_CANCELLED",
]);

function mapExecutionState(execution: Record<string, unknown>): string {
  const conditions = execution.conditions as Array<{ type?: string; state?: string }> | undefined;
  const completed = conditions?.find((c) => c.type === "Completed");
  if (completed?.state === "CONDITION_FAILED") return "EXECUTION_FAILED";
  if (execution.cancelledCount && Number(execution.cancelledCount) > 0) {
    return "EXECUTION_CANCELLED";
  }
  if (completed?.state === "CONDITION_SUCCEEDED") return "EXECUTION_SUCCEEDED";
  if (execution.failedCount && Number(execution.failedCount) > 0) {
    return "EXECUTION_FAILED";
  }
  if (execution.completionTime) return "EXECUTION_SUCCEEDED";
  return "EXECUTION_RUNNING";
}

export async function pollCloudRunExecution(
  executionName: string,
): Promise<{ state: string; execution: Record<string, unknown> }> {
  const res = await gcpFetch(executionName, { method: "GET" });
  if (!res.ok) {
    throw new Error(`pollCloudRunExecution: ${res.status} ${await res.text()}`);
  }
  const execution = await res.json() as Record<string, unknown>;
  const state = mapExecutionState(execution);
  return { state, execution };
}

/** 429 / 5xx / network failures from the Cloud Run Admin API or Storage signing are safe to retry. */
export function isRetryableCloudRunSubmitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cloud Run Job run failed: (429|5\d\d)\b/.test(msg)) return true;
  return /\b(502|503|504)\b|fetch failed|network|timed? ?out|ECONN|ETIMEDOUT|ENOTFOUND|UNAVAILABLE/i
    .test(msg);
}
