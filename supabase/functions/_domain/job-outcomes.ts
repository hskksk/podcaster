import type { JobRow } from "../_jobs/types.ts";
import { audioTranscodedEvent } from "../_jobs/transcode-domain-events.ts";
import type { DomainEvent, NewDomainEvent } from "./events.ts";

export function domainEventsForSucceededJob(job: JobRow): NewDomainEvent[] {
  const productionId = job.correlation_id;
  if (!productionId) return [];

  const occurredAt = new Date().toISOString();
  const actor = "job-worker";
  const causationId = job.requested_by_event_id ?? undefined;

  switch (job.job_type) {
    case "write_script": {
      const out = job.output ?? {};
      const scriptId = crypto.randomUUID();
      return [{
        type: "ScriptWritten",
        stream_type: "production",
        stream_id: productionId,
        stream_version: 0,
        occurred_at: occurredAt,
        actor,
        correlation_id: productionId,
        causation_id: causationId ?? null,
        payload: {
          script_id: scriptId,
          job_id: job.id,
          title: String(out.title ?? ""),
          description: String(out.description ?? ""),
          content: String(out.script ?? ""),
        },
      }];
    }
    case "render_audio": {
      const out = job.output ?? {};
      if (out.skipped) return [];
      const events: NewDomainEvent[] = [];
      const transcode = out.transcode as Record<string, unknown> | undefined;
      if (transcode && transcode.finalized === true) {
        const transcoded = audioTranscodedEvent(job, {
          job_id: job.id,
          script_id: String(out.script_id ?? job.input?.script_id ?? ""),
          blob_id: String(out.blob_id ?? ""),
          storage_path: String(out.storage_path ?? transcode.output_storage_path ?? ""),
          execution_name: String(transcode.execution ?? ""),
          duration_ms: Number(out.duration_ms ?? 0),
          byte_size: Number(out.byte_size ?? 0),
        });
        if (transcoded) events.push(transcoded);
      }
      events.push({
        type: "AudioRendered",
        stream_type: "production",
        stream_id: productionId,
        stream_version: 0,
        occurred_at: occurredAt,
        actor,
        correlation_id: productionId,
        causation_id: causationId ?? null,
        payload: {
          audio_id: crypto.randomUUID(),
          job_id: job.id,
          script_id: String(out.script_id ?? job.input?.script_id ?? ""),
          blob_id: String(out.blob_id ?? ""),
          duration_ms: Number(out.duration_ms ?? 0),
          casting: (out.casting ?? {}) as Record<string, unknown>,
        },
      });
      return events;
    }
    case "paint_artwork": {
      const out = job.output ?? {};
      if (out.skipped) return [];
      return [{
        type: "ArtworkPainted",
        stream_type: "production",
        stream_id: productionId,
        stream_version: 0,
        occurred_at: occurredAt,
        actor,
        correlation_id: productionId,
        causation_id: causationId ?? null,
        payload: {
          artwork_id: crypto.randomUUID(),
          job_id: job.id,
          script_id: String(out.script_id ?? job.input?.script_id ?? ""),
          blob_id: String(out.blob_id ?? ""),
        },
      }];
    }
    default:
      return [];
  }
}

export function domainEventForFailedJob(job: JobRow, reason: string): NewDomainEvent | null {
  const productionId = job.correlation_id;
  if (!productionId) return null;
  return {
    type: "ProductionFailed",
    stream_type: "production",
    stream_id: productionId,
    stream_version: 0,
    occurred_at: new Date().toISOString(),
    actor: "job-worker",
    correlation_id: productionId,
    causation_id: job.requested_by_event_id ?? null,
    payload: {
      production_id: productionId,
      failed_job_id: job.id,
      reason,
    },
  };
}

/** Assign stream_version placeholders (filled by append layer). */
export function stripStreamVersions(events: NewDomainEvent[]): NewDomainEvent[] {
  return events;
}

/** Replay helper for tests: fold production stream events into progress. */
export function collectProductionEvents(
  events: DomainEvent[],
  productionId: string,
): DomainEvent[] {
  return events.filter(
    (e) =>
      (e.stream_type === "production" && e.stream_id === productionId) ||
      (e.type === "ProductionRequested" && e.payload.production_id === productionId),
  );
}
