import type { DomainEvent, EventEnvelope, NewDomainEvent } from "../../_domain/events.ts";
import { applyLegacyCompatProjection } from "../compat/legacy-projection.ts";
import { applyProjection } from "./projections.ts";

import type postgres from "postgres";

export type Sql = postgres.Sql;

export async function nextStreamVersion(sql: Sql, streamId: string): Promise<number> {
  const rows = await sql<Array<{ v: string }>>`
    select coalesce(max(stream_version), 0)::text as v
    from podcast.domain_events
    where stream_id = ${streamId}::uuid
  `;
  return Number(rows[0]?.v ?? 0) + 1;
}

export interface ReadEventsOptions {
  fromPosition?: number;
  limit?: number;
}

export async function readEvents(
  sql: Sql,
  options: ReadEventsOptions = {},
): Promise<EventEnvelope[]> {
  const fromPosition = options.fromPosition ?? 0;
  const limit = options.limit ?? 10_000;
  const rows = await sql<
    Array<{
      id: string;
      position: string;
      type: EventEnvelope["type"];
      stream_type: EventEnvelope["stream_type"];
      stream_id: string;
      stream_version: string;
      occurred_at: Date;
      actor: string;
      correlation_id: string | null;
      causation_id: string | null;
      payload: EventEnvelope["payload"];
    }>
  >`
    select
      id,
      position,
      type,
      stream_type,
      stream_id,
      stream_version,
      occurred_at,
      actor,
      correlation_id,
      causation_id,
      payload
    from podcast.domain_events
    where position > ${fromPosition}
    order by position asc
    limit ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    position: Number(row.position),
    type: row.type,
    stream_type: row.stream_type,
    stream_id: row.stream_id,
    stream_version: Number(row.stream_version),
    occurred_at: row.occurred_at.toISOString(),
    actor: row.actor,
    correlation_id: row.correlation_id,
    causation_id: row.causation_id,
    payload: row.payload as EventEnvelope["payload"],
  })) as EventEnvelope[];
}

export class StreamVersionConflictError extends Error {
  constructor(
    public readonly streamId: string,
    public readonly streamVersion: number,
  ) {
    super(`stream_version conflict: ${streamId} @ ${streamVersion}`);
    this.name = "StreamVersionConflictError";
  }
}

export async function appendEvent(
  sql: Sql,
  event: NewDomainEvent,
): Promise<EventEnvelope> {
  const id = event.id ?? globalThis.crypto.randomUUID();
  try {
    return await sql.begin(async (tx) => {
      const inserted = await tx<
        Array<{
          id: string;
          position: string;
        }>
      >`
        insert into podcast.domain_events (
          id, type, stream_type, stream_id, stream_version,
          occurred_at, actor, correlation_id, causation_id, payload
        )
        values (
          ${id}::uuid,
          ${event.type},
          ${event.stream_type},
          ${event.stream_id}::uuid,
          ${event.stream_version},
          ${event.occurred_at}::timestamptz,
          ${event.actor},
          ${event.correlation_id ?? null}::uuid,
          ${event.causation_id ?? null}::uuid,
          ${JSON.stringify(event.payload)}::jsonb
        )
        returning id, position
      `;
      const row = inserted[0];
      if (!row) throw new Error("appendEvent: insert returned no row");

      const stored: EventEnvelope = {
        id: row.id,
        position: Number(row.position),
        type: event.type,
        stream_type: event.stream_type,
        stream_id: event.stream_id,
        stream_version: event.stream_version,
        occurred_at: event.occurred_at,
        actor: event.actor,
        correlation_id: event.correlation_id ?? null,
        causation_id: event.causation_id ?? null,
        payload: event.payload,
      };

      await applyProjection(tx, stored as DomainEvent);
      await applyLegacyCompatProjection(tx, stored as DomainEvent);
      return stored;
    });
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
    if (code === "23505") {
      throw new StreamVersionConflictError(event.stream_id, event.stream_version);
    }
    if (
      err instanceof Error &&
      err.message.includes("domain_events_stream_version_key")
    ) {
      throw new StreamVersionConflictError(event.stream_id, event.stream_version);
    }
    throw err;
  }
}

export async function appendEvents(
  sql: Sql,
  events: NewDomainEvent[],
): Promise<EventEnvelope[]> {
  const stored: EventEnvelope[] = [];
  for (const event of events) {
    stored.push(await appendEvent(sql, event));
  }
  return stored;
}

export async function replayAllEvents(sql: Sql): Promise<number> {
  const { truncateProjections } = await import("./projections.ts");
  await truncateProjections(sql);
  const events = await readEvents(sql, { fromPosition: 0, limit: 1_000_000 });
  for (const event of events) {
    await applyProjection(sql, event as DomainEvent);
  }
  return events.length;
}
