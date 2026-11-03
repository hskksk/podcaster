import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Sql } from "../_adapters/eventstore/postgres.ts";
import { appendDomainEvents } from "../_adapters/eventstore/subscription.ts";

export async function assembleEpisodeRevision(
  _db: SupabaseClient,
  sql: Sql,
  productionId: string,
  causationEventId: string,
): Promise<void> {
  const [row] = await sql<Array<{
    episode_id: string;
    script_id: string;
    audio_id: string;
    artwork_id: string | null;
    title: string;
    description: string;
  }>>`
    with prod as (
      select episode_id, base_revision_id
      from podcast.productions
      where id = ${productionId}::uuid
    ),
    current_script as (
      select s.id, s.title, s.description
      from podcast.scripts s
      where s.production_id = ${productionId}::uuid
      order by s.created_at desc
      limit 1
    ),
    current_audio as (
      select a.id
      from podcast.audios a
      where a.production_id = ${productionId}::uuid
      order by a.created_at desc
      limit 1
    ),
    current_artwork as (
      select aw.id
      from podcast.artworks aw
      where aw.production_id = ${productionId}::uuid
      order by aw.created_at desc
      limit 1
    ),
    base_assets as (
      select
        er.script_id,
        er.audio_id,
        er.artwork_id,
        er.title,
        er.description
      from prod p
      join podcast.episode_revisions er on er.id = p.base_revision_id
    )
    select
      p.episode_id,
      coalesce(cs.id, b.script_id) as script_id,
      coalesce(ca.id, b.audio_id) as audio_id,
      coalesce(cw.id, b.artwork_id) as artwork_id,
      coalesce(cs.title, b.title) as title,
      coalesce(cs.description, b.description) as description
    from prod p
    left join current_script cs on true
    left join current_audio ca on true
    left join current_artwork cw on true
    left join base_assets b on true
    limit 1
  `;

  if (!row?.script_id || !row.audio_id) {
    throw new Error(`assembleEpisodeRevision: missing script/audio for ${productionId}`);
  }

  const episodeRevisionId = crypto.randomUUID();
  await appendDomainEvents(sql, [{
    type: "EpisodeAssembled",
    stream_type: "episode",
    stream_id: row.episode_id,
    stream_version: 0,
    occurred_at: new Date().toISOString(),
    actor: "domain-subscriber",
    correlation_id: productionId,
    causation_id: causationEventId,
    payload: {
      episode_revision_id: episodeRevisionId,
      script_id: row.script_id,
      audio_id: row.audio_id,
      artwork_id: row.artwork_id,
      title: row.title,
      description: row.description,
    },
  }]);
}
