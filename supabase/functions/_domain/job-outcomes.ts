import type {
  AudioTranscodedPayload,
  DomainEvent,
  NewDomainEvent,
  NewDomainEventOf,
  ProductionFailureStage,
} from "./events.ts";

export type CreationJobType = "write_script" | "render_audio" | "paint_artwork";

/** Fields the translator reads from a finished job. Kept local so domain tests do not import the jobs package. */
export interface JobOutcomeSource {
  id: string;
  job_type: CreationJobType;
  correlation_id: string | null;
  requested_by_event_id: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
}

const FAILURE_REASON_MAX = 2000;

export function failureStageForJobType(jobType: CreationJobType): ProductionFailureStage {
  switch (jobType) {
    case "write_script":
      return "script";
    case "render_audio":
      return "audio";
    case "paint_artwork":
      return "artwork";
  }
}

/** Keep the domain fact short enough to store and replay. */
export function clipFailureReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return "job failed after retries";
  if (trimmed.length <= FAILURE_REASON_MAX) return trimmed;
  return trimmed.slice(0, FAILURE_REASON_MAX);
}

function audioTranscodedEvent(
  job: JobOutcomeSource,
  payload: AudioTranscodedPayload,
): NewDomainEvent | null {
  const productionId = job.correlation_id;
  if (!productionId) return null;
  return {
    type: "AudioTranscoded",
    stream_type: "production",
    stream_id: productionId,
    stream_version: 0,
    occurred_at: new Date().toISOString(),
    actor: "job-worker",
    correlation_id: productionId,
    causation_id: job.requested_by_event_id ?? null,
    payload,
  };
}

export function domainEventsForSucceededJob(job: JobOutcomeSource): NewDomainEvent[] {
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

export function domainEventForFailedJob(
  job: JobOutcomeSource,
  reason: string,
): NewDomainEventOf<"ProductionFailed"> | null {
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
      stage: failureStageForJobType(job.job_type),
      reason: clipFailureReason(reason),
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
