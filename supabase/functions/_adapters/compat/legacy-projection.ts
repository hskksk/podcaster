import type { DomainEvent } from "../../_domain/events.ts";
import type { SqlExecutor } from "../eventstore/projections.ts";

/** Keep public.* tables in sync while readers still use the legacy pipeline. */
export async function applyLegacyCompatProjection(
  sql: SqlExecutor,
  event: DomainEvent,
): Promise<void> {
  switch (event.type) {
    case "ArticleRegistered":
      await sql`
        insert into public.articles (
          id, title, content, content_path, content_sha, mem_note_id, ingest_route, source
        )
        values (
          ${event.payload.article_id}::uuid,
          ${event.payload.title},
          ${event.payload.content},
          ${event.payload.content_path},
          ${event.payload.content_sha},
          ${event.payload.mem_note_id ?? null},
          ${event.payload.ingest_route},
          'webhook'
        )
        on conflict (id) do update set
          title = excluded.title,
          content = excluded.content,
          content_sha = excluded.content_sha,
          content_path = coalesce(excluded.content_path, public.articles.content_path)
      `;
      break;

    case "EpisodeOpened":
      await sql`
        insert into public.episodes (
          id, article_id, title, description, status, audio_url
        )
        values (
          ${event.payload.episode_id}::uuid,
          ${event.payload.article_id}::uuid,
          'Untitled',
          '',
          'ingested',
          ${`audio/${event.payload.episode_id}.wav`}
        )
        on conflict (id) do nothing
      `;
      break;

    case "ScriptWritten": {
      const [prod] = await sql`
        select episode_id from podcast.productions where id = ${event.correlation_id}::uuid limit 1
      ` as Array<{ episode_id: string }>;
      const episodeId = prod?.episode_id;
      if (!episodeId) break;
      await sql`
        insert into public.scripts (id, episode_id, content, status)
        values (
          ${event.payload.script_id}::uuid,
          ${episodeId}::uuid,
          ${event.payload.content},
          'ready'
        )
        on conflict (id) do update set content = excluded.content, status = 'ready'
      `;
      await sql`
        update public.episodes
        set title = left(${event.payload.title}, 20),
            description = ${event.payload.description},
            status = 'script_ready'
        where id = ${episodeId}::uuid
      `;
      break;
    }

    case "AudioRendered": {
      const [row] = await sql`
        select b.storage_path, b.mime_type, p.episode_id
        from podcast.blobs b
        join podcast.productions p on p.id = ${event.correlation_id}::uuid
        where b.id = ${event.payload.blob_id}::uuid
        limit 1
      ` as Array<{ storage_path: string; mime_type: string; episode_id: string }>;
      if (!row) break;
      await sql`
        insert into public.audio_files (
          id, episode_id, script_id, storage_path, mime_type, status
        )
        values (
          ${event.payload.audio_id}::uuid,
          ${row.episode_id}::uuid,
          ${event.payload.script_id}::uuid,
          ${row.storage_path},
          ${row.mime_type},
          'ready'
        )
        on conflict (id) do nothing
      `;
      await sql`
        update public.episodes
        set status = 'audio_generated', audio_url = ${row.storage_path}
        where id = ${row.episode_id}::uuid
      `;
      break;
    }

    case "ArtworkPainted": {
      const [row] = await sql`
        select b.storage_path, p.episode_id
        from podcast.blobs b
        join podcast.productions p on p.id = ${event.correlation_id}::uuid
        where b.id = ${event.payload.blob_id}::uuid
        limit 1
      ` as Array<{ storage_path: string; episode_id: string }>;
      if (!row) break;
      await sql`
        update public.episodes
        set image_url = ${row.storage_path}
        where id = ${row.episode_id}::uuid
      `;
      break;
    }

    case "EpisodeAssembled":
      await sql`
        update public.episodes
        set title = left(${event.payload.title}, 20),
            description = ${event.payload.description},
            status = 'audio_ready'
        where id = ${event.stream_id}::uuid
      `;
      break;

    case "EpisodePublished":
      await sql`
        update public.episodes e
        set status = 'published',
            published_at = ${event.occurred_at}::timestamptz
        from podcast.episode_revisions er
        where er.id = ${event.payload.episode_revision_id}::uuid
          and e.id = er.episode_id
      `;
      break;

    case "EpisodeWithdrawn":
      await sql`
        update public.episodes e
        set status = 'audio_ready',
            published_at = null
        from podcast.episode_publications pub
        join podcast.episode_revisions er on er.id = pub.episode_revision_id
        where pub.id = ${event.payload.publication_id}::uuid
          and e.id = er.episode_id
      `;
      break;

    default:
      break;
  }
}
