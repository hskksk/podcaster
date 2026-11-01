import { randomUUID } from "node:crypto";
import {
  appendEvent,
  nextStreamVersion,
} from "../../supabase/functions/_adapters/eventstore/postgres.ts";
import { buildProductionProfile, loadPodcastConfigMap } from "./production-profile.ts";
import type postgres from "postgres";

export async function appendManualProductionRequested(
  sql: postgres.Sql,
  opts: {
    episodeId: string;
    scope: "full" | "audio" | "artwork";
  },
): Promise<string> {
  const [episode] = await sql<Array<{ article_id: string }>>`
    select article_id from podcast.episodes where id = ${opts.episodeId}::uuid limit 1
  `;
  if (!episode) throw new Error(`Episode not found in podcast.episodes: ${opts.episodeId}`);

  const [revision] = await sql<Array<{ id: string }>>`
    select id from podcast.article_revisions
    where article_id = ${episode.article_id}::uuid
    order by registered_at desc
    limit 1
  `;
  if (!revision) {
    throw new Error(`No article revision for episode ${opts.episodeId}. Run events:backfill first.`);
  }

  let baseRevisionId: string | null = null;
  if (opts.scope !== "full") {
    const [base] = await sql<Array<{ id: string }>>`
      select id from podcast.episode_revisions
      where episode_id = ${opts.episodeId}::uuid
      order by assembled_at desc
      limit 1
    `;
    if (!base) {
      throw new Error(
        `No episode revision to reuse for scope=${opts.scope}. Complete a full production first.`,
      );
    }
    baseRevisionId = base.id;
  }

  const config = await loadPodcastConfigMap(sql);
  const profile = buildProductionProfile(config);
  const productionId = randomUUID();
  const streamVersion = await nextStreamVersion(sql, productionId);
  const occurredAt = new Date().toISOString();

  await appendEvent(sql, {
    type: "ProductionRequested",
    stream_type: "production",
    stream_id: productionId,
    stream_version: streamVersion,
    occurred_at: occurredAt,
    actor: "manual",
    correlation_id: productionId,
    causation_id: null,
    payload: {
      production_id: productionId,
      episode_id: opts.episodeId,
      article_revision_id: revision.id,
      base_revision_id: baseRevisionId,
      scope: opts.scope,
      trigger: "manual",
      profile,
    },
  });

  return productionId;
}

export async function latestAssembledRevisionId(
  sql: postgres.Sql,
  episodeId: string,
): Promise<string | null> {
  const [row] = await sql<Array<{ id: string }>>`
    select id from podcast.episode_revisions
    where episode_id = ${episodeId}::uuid
    order by assembled_at desc
    limit 1
  `;
  return row?.id ?? null;
}
