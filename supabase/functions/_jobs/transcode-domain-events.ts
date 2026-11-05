import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { appendDomainEvents } from "../_adapters/eventstore/subscription.ts";
import type {
  AudioTranscodeSubmittedPayload,
  AudioTranscodedPayload,
  NewDomainEvent,
} from "../_domain/events.ts";
import { getPostgresSql } from "../_shared/postgres.ts";
import type { JobRow } from "./types.ts";

function baseProductionEvent(job: JobRow): Omit<NewDomainEvent, "type" | "payload"> | null {
  const productionId = job.correlation_id;
  if (!productionId) return null;
  return {
    stream_type: "production",
    stream_id: productionId,
    stream_version: 0,
    occurred_at: new Date().toISOString(),
    actor: "job-worker",
    correlation_id: productionId,
    causation_id: job.requested_by_event_id ?? null,
  };
}

export async function appendAudioTranscodeSubmitted(
  _db: SupabaseClient,
  job: JobRow,
  payload: AudioTranscodeSubmittedPayload,
): Promise<void> {
  const base = baseProductionEvent(job);
  if (!base) return;
  const sql = getPostgresSql();
  await appendDomainEvents(sql, [{
    ...base,
    type: "AudioTranscodeSubmitted",
    payload,
  }]);
}

export function audioTranscodedEvent(
  job: JobRow,
  payload: AudioTranscodedPayload,
): NewDomainEvent | null {
  const base = baseProductionEvent(job);
  if (!base) return null;
  return {
    ...base,
    type: "AudioTranscoded",
    payload,
  };
}
