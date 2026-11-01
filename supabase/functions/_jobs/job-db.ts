import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { AttemptOutcome, JobRow, JobRunResult, JobStatus } from "./types.ts";

export async function loadJob(db: SupabaseClient, jobId: string): Promise<JobRow | null> {
  const { data, error } = await db
    .schema("jobs")
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(`loadJob: ${error.message}`);
  return data as JobRow | null;
}

export async function nextAttemptNo(db: SupabaseClient, jobId: string): Promise<number> {
  const { count, error } = await db
    .schema("jobs")
    .from("job_attempts")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);
  if (error) throw new Error(`nextAttemptNo: ${error.message}`);
  return (count ?? 0) + 1;
}

export async function startAttempt(
  db: SupabaseClient,
  jobId: string,
  attemptNo: number,
): Promise<string> {
  const { data, error } = await db
    .schema("jobs")
    .from("job_attempts")
    .insert({ job_id: jobId, attempt_no: attemptNo })
    .select("id")
    .single();
  if (error || !data) throw new Error(`startAttempt: ${error?.message}`);
  return data.id as string;
}

export async function finishAttempt(
  db: SupabaseClient,
  attemptId: string,
  outcome: AttemptOutcome,
  errorMessage?: string,
): Promise<void> {
  const { error } = await db
    .schema("jobs")
    .from("job_attempts")
    .update({
      outcome,
      error_message: errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", attemptId);
  if (error) throw new Error(`finishAttempt: ${error.message}`);
}

export async function setJobStatus(
  db: SupabaseClient,
  jobId: string,
  status: JobStatus,
  patch?: { output?: Record<string, unknown>; finished_at?: string | null },
): Promise<void> {
  const { error } = await db
    .schema("jobs")
    .from("jobs")
    .update({
      status,
      ...(patch?.output !== undefined ? { output: patch.output } : {}),
      ...(patch?.finished_at !== undefined ? { finished_at: patch.finished_at } : {}),
    })
    .eq("id", jobId);
  if (error) throw new Error(`setJobStatus: ${error.message}`);
}

export async function recordLlmInvocation(
  db: SupabaseClient,
  row: {
    attempt_id: string;
    external_operation_id?: string | null;
    item_index?: number;
    model: string;
    params?: Record<string, unknown>;
    input_tokens?: number | null;
    output_tokens?: number | null;
    latency_ms?: number | null;
    finish_reason?: string | null;
  },
): Promise<void> {
  const { error } = await db.schema("jobs").from("llm_invocations").insert({
    attempt_id: row.attempt_id,
    external_operation_id: row.external_operation_id ?? null,
    item_index: row.item_index ?? 0,
    model: row.model,
    params: row.params ?? {},
    input_tokens: row.input_tokens ?? null,
    output_tokens: row.output_tokens ?? null,
    latency_ms: row.latency_ms ?? null,
    finish_reason: row.finish_reason ?? null,
  });
  if (error) throw new Error(`recordLlmInvocation: ${error.message}`);
}

export function classifyError(err: unknown): AttemptOutcome {
  const msg = String(err);
  if (/429|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) return "rate_limited";
  if (/timeout|ETIMEDOUT|ECONNRESET/i.test(msg)) return "retryable";
  return "terminal";
}

export async function applyJobResult(
  db: SupabaseClient,
  job: JobRow,
  attemptId: string,
  result: JobRunResult,
): Promise<{ done: boolean }> {
  if (result.waitingExternal) {
    await finishAttempt(db, attemptId, "succeeded");
    await setJobStatus(db, job.id, "waiting_external");
    return { done: true };
  }

  if (result.outcome === "succeeded") {
    await finishAttempt(db, attemptId, "succeeded");
    await setJobStatus(db, job.id, "succeeded", {
      output: result.output ?? {},
      finished_at: new Date().toISOString(),
    });
    return { done: true };
  }

  await finishAttempt(db, attemptId, result.outcome, result.errorMessage);

  const { data: jobType } = await db
    .schema("jobs")
    .from("job_types")
    .select("retry_policy")
    .eq("name", job.job_type)
    .maybeSingle();

  const maxAttempts = Number(
    (jobType?.retry_policy as { max_attempts?: number } | null)?.max_attempts ?? 3,
  );
  const { count } = await db
    .schema("jobs")
    .from("job_attempts")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id);

  const attempts = count ?? 0;
  const canRetry =
    (result.outcome === "retryable" || result.outcome === "rate_limited") &&
    attempts < maxAttempts;

  if (canRetry) {
    await setJobStatus(db, job.id, "requested");
    return { done: false };
  }

  await setJobStatus(db, job.id, "failed", {
    finished_at: new Date().toISOString(),
  });
  return { done: true };
}
