import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { loadConfig } from "../_shared/config.ts";
import { resolveGeminiApiRoot } from "../_adapters/gemini/endpoint.ts";
import {
  DEFAULT_SYSTEM_INSTRUCTION,
  DEFAULT_USER_PROMPT_TEMPLATE,
} from "../../../shared/script-generation.ts";
import {
  applyJobResult,
  classifyError,
  finishAttempt,
  loadJob,
  nextAttemptNo,
  setJobStatus,
  startAttempt,
} from "./job-db.ts";
import type { JobHandler, JobTypeName } from "./types.ts";
import { handlePaintArtwork } from "./handlers/paint-artwork.ts";
import { handleRenderAudio } from "./handlers/render-audio.ts";
import { handleWriteScript } from "./handlers/write-script.ts";

const HANDLERS: Record<JobTypeName, JobHandler> = {
  write_script: handleWriteScript,
  render_audio: handleRenderAudio,
  paint_artwork: handlePaintArtwork,
};

export async function runJobById(db: SupabaseClient, jobId: string): Promise<Record<string, unknown>> {
  const job = await loadJob(db, jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
    return { jobId, status: job.status, output: job.output };
  }

  if (job.status === "requested" || job.status === "waiting_external") {
    await setJobStatus(db, job.id, "running");
  }

  const attemptNo = await nextAttemptNo(db, job.id);
  const attemptId = await startAttempt(db, job.id, attemptNo);
  const handler = HANDLERS[job.job_type];
  if (!handler) throw new Error(`No handler for job_type ${job.job_type}`);

  try {
    const result = await handler({ db, job, attemptId, attemptNo });
    await applyJobResult(db, job, attemptId, result);
    const updated = await loadJob(db, job.id);
    return {
      jobId: job.id,
      status: updated?.status ?? job.status,
      output: updated?.output,
      waitingExternal: result.waitingExternal === true,
    };
  } catch (err) {
    const outcome = classifyError(err);
    await finishAttempt(db, attemptId, outcome, String(err));
    await applyJobResult(db, job, attemptId, {
      outcome,
      errorMessage: String(err),
    });
    throw err;
  }
}

/** Resolve profile keys from job input + podcast_config (legacy keys). */
export async function resolveProfile(
  inputProfile: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> {
  const cfg = await loadConfig();
  return { ...cfg, ...(inputProfile ?? {}) };
}

export async function resolveGeneratorPrompts(profile: Record<string, unknown>): Promise<{
  systemInstruction: string;
  promptTemplate: string;
  model: string;
  apiRoot: string;
}> {
  const systemInstruction =
    (profile["generator.system_instruction"] as string | undefined) ||
    DEFAULT_SYSTEM_INSTRUCTION;
  const promptTemplate =
    (profile["generator.prompt_template"] as string | undefined) ||
    DEFAULT_USER_PROMPT_TEMPLATE;
  const model = (profile["generator.model"] as string | undefined) || "gemini-2.5-flash";
  const apiRoot = resolveGeminiApiRoot(profile as Record<string, string>);
  return { systemInstruction, promptTemplate, model, apiRoot };
}
