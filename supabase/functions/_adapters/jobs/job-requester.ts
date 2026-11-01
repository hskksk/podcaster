import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { JobTypeName } from "../../_jobs/types.ts";
import { dispatchRunJob } from "../pgflow.ts";

export async function requestJob(
  db: SupabaseClient,
  params: {
    jobType: JobTypeName;
    correlationId: string;
    requestedByEventId: string;
    idempotencyKey: string;
    input: Record<string, unknown>;
  },
): Promise<{ jobId: string; created: boolean }> {
  const jobId = crypto.randomUUID();
  const { error: insertErr } = await db.schema("jobs").from("jobs").insert({
    id: jobId,
    job_type: params.jobType,
    correlation_id: params.correlationId,
    requested_by_event_id: params.requestedByEventId,
    idempotency_key: params.idempotencyKey,
    input: params.input,
    status: "requested",
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: existing } = await db
        .schema("jobs")
        .from("jobs")
        .select("id")
        .eq("job_type", params.jobType)
        .eq("idempotency_key", params.idempotencyKey)
        .maybeSingle();
      if (existing?.id) return { jobId: existing.id as string, created: false };
    }
    throw new Error(`requestJob insert: ${insertErr.message}`);
  }

  await dispatchRunJob(db, jobId);
  return { jobId, created: true };
}
