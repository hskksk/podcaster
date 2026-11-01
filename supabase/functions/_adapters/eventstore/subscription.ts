import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { DomainEvent, NewDomainEvent } from "../../_domain/events.ts";
import {
  appendEvent,
  nextStreamVersion,
  readEvents,
  type Sql,
} from "./postgres.ts";

export const PRODUCTION_POLICY_SUBSCRIBER_ID = "production-policy";
const LEASE_SECONDS = 45;
const BATCH_LIMIT = 20;

export async function tryAcquireLease(sql: Sql, owner: string): Promise<boolean> {
  const until = new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
  const rows = await sql<Array<{ subscriber_id: string }>>`
    update podcast.event_subscriptions
    set lease_owner = ${owner},
        leased_until = ${until}::timestamptz,
        updated_at = now()
    where subscriber_id = ${PRODUCTION_POLICY_SUBSCRIBER_ID}
      and (leased_until is null or leased_until < now())
    returning subscriber_id
  `;
  return rows.length > 0;
}

export async function releaseLease(sql: Sql, owner: string): Promise<void> {
  await sql`
    update podcast.event_subscriptions
    set lease_owner = null,
        leased_until = null,
        updated_at = now()
    where subscriber_id = ${PRODUCTION_POLICY_SUBSCRIBER_ID}
      and lease_owner = ${owner}
  `;
}

export async function getCheckpoint(sql: Sql): Promise<number> {
  const rows = await sql<Array<{ last_processed_position: string }>>`
    select last_processed_position::text
    from podcast.event_subscriptions
    where subscriber_id = ${PRODUCTION_POLICY_SUBSCRIBER_ID}
    limit 1
  `;
  return Number(rows[0]?.last_processed_position ?? 0);
}

export async function advanceCheckpoint(sql: Sql, position: number): Promise<void> {
  await sql`
    update podcast.event_subscriptions
    set last_processed_position = greatest(last_processed_position, ${position}),
        updated_at = now()
    where subscriber_id = ${PRODUCTION_POLICY_SUBSCRIBER_ID}
  `;
}

export async function recordSubscriptionFailure(
  sql: Sql,
  position: number,
  message: string,
): Promise<void> {
  await sql`
    insert into podcast.event_subscription_failures (
      subscriber_id, event_position, error_message
    )
    values (
      ${PRODUCTION_POLICY_SUBSCRIBER_ID},
      ${position},
      ${message}
    )
    on conflict (subscriber_id, event_position) do update
      set error_message = excluded.error_message,
          failed_at = now()
  `;
}

export async function readPendingEvents(sql: Sql, fromPosition: number): Promise<DomainEvent[]> {
  const events = await readEvents(sql, { fromPosition, limit: BATCH_LIMIT });
  return events as DomainEvent[];
}

export async function appendDomainEvents(sql: Sql, events: NewDomainEvent[]): Promise<void> {
  for (const event of events) {
    const streamVersion = event.stream_version > 0
      ? event.stream_version
      : await nextStreamVersion(sql, event.stream_id);
    await appendEvent(sql, { ...event, stream_version: streamVersion });
  }
}

export async function drainPgmqWake(_sql: Sql): Promise<number> {
  return 0;
}

export type ProcessEventFn = (
  db: SupabaseClient,
  sql: Sql,
  event: DomainEvent,
) => Promise<void>;

export async function processSubscriptionBatch(
  db: SupabaseClient,
  sql: Sql,
  handleEvent: ProcessEventFn,
): Promise<{ processed: number }> {
  const owner = crypto.randomUUID();
  if (!await tryAcquireLease(sql, owner)) {
    return { processed: 0 };
  }

  let processed = 0;
  try {
    await drainPgmqWake(sql);
    let checkpoint = await getCheckpoint(sql);
    const events = await readPendingEvents(sql, checkpoint);

    for (const event of events) {
      if (!event.position) continue;
      try {
        await handleEvent(db, sql, event);
        await advanceCheckpoint(sql, event.position);
        processed++;
        checkpoint = event.position;
      } catch (err) {
        await recordSubscriptionFailure(sql, event.position, String(err));
        throw err;
      }
    }
  } finally {
    await releaseLease(sql, owner);
  }

  return { processed };
}
