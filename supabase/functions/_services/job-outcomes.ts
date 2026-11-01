import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  domainEventForFailedJob,
  domainEventsForSucceededJob,
} from "../_domain/job-outcomes.ts";
import { getPostgresSql } from "../_shared/postgres.ts";
import { loadJob } from "../_jobs/job-db.ts";
import { appendDomainEvents, processSubscriptionBatch } from "../_adapters/eventstore/subscription.ts";
import { handleProductionPolicyEvent } from "./production-policy-handler.ts";

export async function onJobFinished(db: SupabaseClient, jobId: string): Promise<void> {
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
    const failed = domainEventForFailedJob(job, "job failed after retries");
    if (failed) await appendDomainEvents(sql, [failed]);
  } else {
    return;
  }

  await processSubscriptionBatch(db, sql, handleProductionPolicyEvent);
}
