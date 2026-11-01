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
    select
      p.episode_id,
      s.id as script_id,
      a.id as audio_id,
      aw.id as artwork_id,
      s.title,
      s.description
    from podcast.productions p
    join podcast.scripts s on s.production_id = p.id
    join podcast.audios a on a.production_id = p.id
    left join podcast.artworks aw on aw.production_id = p.id
    where p.id = ${productionId}::uuid
    order by s.created_at desc, a.created_at desc, aw.created_at desc
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
