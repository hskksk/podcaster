import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { DomainEvent, ProductionRequestedPayload } from "../_domain/events.ts";
import { commandsForEvent, type PolicyContext, type PolicyScriptContext } from "../_domain/production-policy.ts";
import {
  applyProductionEvent,
  emptyProductionProgress,
} from "../_domain/production-state.ts";
import { isArtworkEnabled } from "../_domain/profile.ts";
import { requestJob } from "../_adapters/jobs/job-requester.ts";
import {
  appendDomainEvents,
  type Sql,
} from "../_adapters/eventstore/subscription.ts";
import { assembleEpisodeRevision } from "./assemble-episode.ts";
import { publishEpisodeRevision } from "./publish-episode.ts";
import type { NewDomainEvent } from "../_domain/events.ts";
import { parseDomainEventPayload } from "../_domain/event-payload.ts";

const POLICY_EVENT_TYPES = new Set<DomainEvent["type"]>([
  "ProductionRequested",
  "ScriptWritten",
  "AudioRendered",
  "ArtworkPainted",
  "EpisodeAssembled",
]);

export async function handleProductionPolicyEvent(
  db: SupabaseClient,
  sql: Sql,
  event: DomainEvent,
): Promise<void> {
  if (!POLICY_EVENT_TYPES.has(event.type)) return;
  if (!event.id) return;

  const productionId = resolveProductionId(event);
  if (!productionId) return;

  const production = await loadProduction(sql, productionId);
  if (!production) return;

  // Backfill replay: historical rows are already projected; do not enqueue jobs again.
  if (production.trigger === "migration") return;

  const ctx = await buildPolicyContext(sql, production, event);
  const commands = commandsForEvent(event, ctx);

  for (const command of commands) {
    if (command.kind === "noop") continue;
    if (command.kind === "request_job") {
      await requestJob(db, {
        jobType: command.jobType,
        correlationId: production.production_id,
        requestedByEventId: event.id,
        idempotencyKey: command.idempotencyKey,
        input: command.input,
      });
    } else if (command.kind === "assemble") {
      await assembleEpisodeRevision(db, sql, production.production_id, event.id);
    } else if (command.kind === "auto_publish") {
      await publishEpisodeRevision(db, sql, {
        episodeId: command.episodeId,
        episodeRevisionId: command.episodeRevisionId,
        actor: "domain-subscriber",
        causationEventId: event.id,
      });
    } else if (command.kind === "production_failed") {
      await appendDomainEvents(sql, [{
        type: "ProductionFailed",
        stream_type: "production",
        stream_id: production.production_id,
        stream_version: 0,
        occurred_at: new Date().toISOString(),
        actor: "domain-subscriber",
        correlation_id: production.production_id,
        causation_id: event.id,
        payload: {
          production_id: production.production_id,
          failed_job_id: null,
          stage: command.stage,
          reason: command.reason,
        },
      }]);
    }
  }
}

function resolveProductionId(event: DomainEvent): string | null {
  if (event.type === "ProductionRequested") {
    const payload = parseDomainEventPayload<ProductionRequestedPayload>(event.payload);
    return payload.production_id ?? event.stream_id ?? null;
  }
  if (event.correlation_id) return event.correlation_id;
  return null;
}

async function loadProduction(
  sql: Sql,
  productionId: string,
): Promise<ProductionRequestedPayload | null> {
  const rows = await sql<Array<{
    id: string;
    episode_id: string;
    article_revision_id: string;
    base_revision_id: string | null;
    scope: ProductionRequestedPayload["scope"];
    trigger: ProductionRequestedPayload["trigger"];
    profile: ProductionRequestedPayload["profile"];
  }>>`
    select id, episode_id, article_revision_id, base_revision_id, scope, trigger, profile
    from podcast.productions
    where id = ${productionId}::uuid
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    production_id: row.id,
    episode_id: row.episode_id,
    article_revision_id: row.article_revision_id,
    base_revision_id: row.base_revision_id,
    scope: row.scope,
    trigger: row.trigger,
    profile: row.profile,
  };
}

async function buildPolicyContext(
  sql: Sql,
  production: ProductionRequestedPayload,
  event: DomainEvent,
): Promise<PolicyContext> {
  const streamEvents = await sql<Array<{
    type: DomainEvent["type"];
    correlation_id: string | null;
    payload: DomainEvent["payload"];
  }>>`
    select type, correlation_id, payload
    from podcast.domain_events
    where stream_type = 'production' and stream_id = ${production.production_id}::uuid
    order by stream_version asc
  `;

  let progress = emptyProductionProgress(
    production,
    isArtworkEnabled(production.profile),
  );
  for (const row of streamEvents) {
    progress = applyProductionEvent(
      progress,
      {
        type: row.type,
        correlation_id: row.correlation_id,
        payload: parseDomainEventPayload(row.payload),
      } as DomainEvent,
    );
  }

  if (production.base_revision_id && production.scope !== "full") {
    const [base] = await sql<Array<{
      script_id: string;
      audio_id: string;
      artwork_id: string | null;
    }>>`
      select script_id, audio_id, artwork_id
      from podcast.episode_revisions
      where id = ${production.base_revision_id}::uuid
      limit 1
    `;
    if (base) {
      if (production.scope === "artwork") {
        progress = {
          ...progress,
          scriptId: base.script_id,
          audioId: base.audio_id,
        };
      } else if (production.scope === "audio") {
        progress = {
          ...progress,
          scriptId: base.script_id,
          artworkId: base.artwork_id,
        };
      }
    }
  }

  const [articleRow] = await sql<Array<{ content: string }>>`
    select content from podcast.article_revisions
    where id = ${production.article_revision_id}::uuid
    limit 1
  `;

  const [showRow] = await sql<Array<{ publication_policy: "auto" | "manual" }>>`
    select publication_policy from podcast.shows limit 1
  `;

  const baseScript = await loadBaseScript(sql, production);

  return {
    progress,
    production,
    publicationPolicy: showRow?.publication_policy ?? "auto",
    articleContent: articleRow?.content ?? "",
    causationEventId: event.id ?? production.production_id,
    baseScript,
  };
}

async function loadBaseScript(
  sql: Sql,
  production: ProductionRequestedPayload,
): Promise<PolicyScriptContext | null> {
  if (!production.base_revision_id) {
    const [script] = await sql<Array<{
      id: string;
      title: string;
      description: string;
      content: string;
    }>>`
      select id, title, description, content
      from podcast.scripts
      where production_id = ${production.production_id}::uuid
      order by created_at desc
      limit 1
    `;
    if (!script) return null;
    return {
      scriptId: script.id,
      title: script.title,
      description: script.description,
      content: script.content,
      articleExcerpt: "",
    };
  }

  const [rev] = await sql<Array<{ script_id: string }>>`
    select script_id from podcast.episode_revisions
    where id = ${production.base_revision_id}::uuid
    limit 1
  `;
  if (!rev) return null;

  const [script] = await sql<Array<{
    id: string;
    title: string;
    description: string;
    content: string;
  }>>`
    select id, title, description, content
    from podcast.scripts where id = ${rev.script_id}::uuid limit 1
  `;
  if (!script) return null;
  return {
    scriptId: script.id,
    title: script.title,
    description: script.description,
    content: script.content,
    articleExcerpt: "",
  };
}

export async function appendJobOutcomeEvents(
  sql: Sql,
  events: NewDomainEvent[],
): Promise<void> {
  await appendDomainEvents(sql, events);
}
