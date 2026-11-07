import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  domainEventForFailedJob,
  domainEventsForSucceededJob,
} from "../_domain/job-outcomes.ts";
import { getPostgresSql } from "../_shared/postgres.ts";
import { loadJob } from "../_jobs/job-db.ts";
import { appendDomainEvents, processSubscriptionBatch } from "../_adapters/eventstore/subscription.ts";
import { handleProductionPolicyEvent } from "./production-policy-handler.ts";

export async function onJobFinished(
  db: SupabaseClient,
  jobId: string,
  options?: { reason?: string },
): Promise<void> {
  const job = await loadJob(db, jobId);
  if (!job) return;
  if (!job.correlation_id) return;

  const sql = getPostgresSql();

  if (job.status === "succeeded") {
    const events = domainEventsForSucceededJob(job);
    if (events.length > 0) {
      await appendDomainEvents(sql, events);
    }
  } else if (job.status === "failed") {
    const already = await productionFailureAlreadyRecorded(sql, job.correlation_id, job.id);
    if (!already) {
      const reason = await failureReasonForJob(db, job.id, options?.reason);
      const failed = domainEventForFailedJob(job, reason);
      if (failed) await appendDomainEvents(sql, [failed]);
    }
  } else {
    return;
  }

  await processSubscriptionBatch(db, sql, handleProductionPolicyEvent);
}

async function productionFailureAlreadyRecorded(
  sql: ReturnType<typeof getPostgresSql>,
  productionId: string,
  jobId: string,
): Promise<boolean> {
  const rows = await sql<Array<{ ok: number }>>`
    select 1 as ok
    from podcast.domain_events
    where type = 'ProductionFailed'
      and stream_id = ${productionId}::uuid
      and payload->>'failed_job_id' = ${jobId}
    limit 1
  `;
  return rows.length > 0;
}

async function failureReasonForJob(
  db: SupabaseClient,
  jobId: string,
  override?: string,
): Promise<string> {
  const given = override?.trim();
  if (given) return given;

  const { data, error } = await db
    .schema("jobs")
    .from("job_attempts")
    .select("error_message, attempt_no")
    .eq("job_id", jobId)
    .order("attempt_no", { ascending: false })
    .limit(5);
  if (error) throw new Error(`failureReasonForJob: ${error.message}`);

  const message = (data ?? [])
    .map((row) => (typeof row.error_message === "string" ? row.error_message.trim() : ""))
    .find((text) => text.length > 0);
  return message || "job failed after retries";
}
