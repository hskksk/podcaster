import type { DomainEvent } from "../../_domain/events.ts";

/** postgres.js transaction or root Sql (same tagged-template API). */
export type SqlExecutor = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (strings: TemplateStringsArray, ...values: any[]): Promise<unknown[]>;
};

export async function applyProjection(
  sql: SqlExecutor,
  event: DomainEvent,
): Promise<void> {
  switch (event.type) {
    case "ShowConfigured":
      await sql`
        insert into podcast.shows (id, title, description, cover_blob_id, publication_policy, updated_at)
        values (
          ${event.payload.show_id}::uuid,
          ${event.payload.title},
          ${event.payload.description},
          ${event.payload.cover_blob_id ?? null}::uuid,
          ${event.payload.publication_policy},
          ${event.occurred_at}::timestamptz
        )
        on conflict (id) do update set
          title = excluded.title,
          description = excluded.description,
          cover_blob_id = excluded.cover_blob_id,
          publication_policy = excluded.publication_policy,
          updated_at = excluded.updated_at
      `;
      break;

    case "ArticleRegistered":
      await sql`
        insert into podcast.articles (id, content_path, mem_note_id, created_at)
        values (
          ${event.payload.article_id}::uuid,
          ${event.payload.content_path},
          ${event.payload.mem_note_id ?? null},
          ${event.occurred_at}::timestamptz
        )
        on conflict (id) do nothing
      `;
      await sql`
        insert into podcast.article_revisions (
          id, article_id, content_sha, title, content, registered_at
        )
        values (
          ${event.payload.article_revision_id}::uuid,
          ${event.payload.article_id}::uuid,
          ${event.payload.content_sha},
          ${event.payload.title},
          ${event.payload.content},
          ${event.occurred_at}::timestamptz
        )
        on conflict (id) do nothing
      `;
      break;

    case "EpisodeOpened":
      await sql`
        insert into podcast.episodes (id, show_id, article_id, guid, created_at)
        values (
          ${event.payload.episode_id}::uuid,
          ${event.payload.show_id}::uuid,
          ${event.payload.article_id}::uuid,
          ${event.payload.guid},
          ${event.occurred_at}::timestamptz
        )
        on conflict (id) do nothing
      `;
      break;

    case "ProductionRequested":
      await sql`
        insert into podcast.productions (
          id, episode_id, article_revision_id, base_revision_id,
          scope, trigger, profile, requested_at
        )
        values (
          ${event.payload.production_id}::uuid,
          ${event.payload.episode_id}::uuid,
          ${event.payload.article_revision_id}::uuid,
          ${event.payload.base_revision_id ?? null}::uuid,
          ${event.payload.scope},
          ${event.payload.trigger},
          ${JSON.stringify(event.payload.profile)}::jsonb,
          ${event.occurred_at}::timestamptz
        )
        on conflict (id) do nothing
      `;
      break;

    case "ScriptWritten": {
      const [prod] = await sql`
        select article_revision_id, id as production_id
        from podcast.productions
        where id = ${event.correlation_id}::uuid
        limit 1
      ` as Array<{ article_revision_id: string; production_id: string }>;
      const articleRevisionId = prod?.article_revision_id;
      const productionId = prod?.production_id ?? event.correlation_id;
      if (!articleRevisionId || !productionId) {
        throw new Error(`ScriptWritten: production not found for correlation ${event.correlation_id}`);
      }
      await sql`
        insert into podcast.scripts (
          id, article_revision_id, production_id, produced_by_job_id,
          title, description, content, created_at
        )
        values (
          ${event.payload.script_id}::uuid,
          ${articleRevisionId}::uuid,
          ${productionId}::uuid,
          ${event.payload.job_id ?? null}::uuid,
          ${event.payload.title},
          ${event.payload.description},
          ${event.payload.content},
          ${event.occurred_at}::timestamptz
        )
        on conflict (id) do nothing
      `;
      break;
    }

    case "AudioRendered":
      await sql`
        insert into podcast.audios (
          id, script_id, production_id, produced_by_job_id,
          blob_id, duration_ms, casting, created_at
        )
        values (
          ${event.payload.audio_id}::uuid,
          ${event.payload.script_id}::uuid,
          ${event.correlation_id}::uuid,
          ${event.payload.job_id ?? null}::uuid,
          ${event.payload.blob_id}::uuid,
          ${event.payload.duration_ms},
          ${JSON.stringify(event.payload.casting)}::jsonb,
          ${event.occurred_at}::timestamptz
        )
        on conflict (id) do nothing
      `;
      break;

    case "ArtworkPainted":
      await sql`
        insert into podcast.artworks (
          id, script_id, production_id, produced_by_job_id, blob_id, created_at
        )
        values (
          ${event.payload.artwork_id}::uuid,
          ${event.payload.script_id}::uuid,
          ${event.correlation_id}::uuid,
          ${event.payload.job_id ?? null}::uuid,
          ${event.payload.blob_id}::uuid,
          ${event.occurred_at}::timestamptz
        )
        on conflict (id) do nothing
      `;
      break;

    case "EpisodeAssembled":
      await sql`
        insert into podcast.episode_revisions (
          id, episode_id, production_id, script_id, audio_id, artwork_id,
          title, description, assembled_at
        )
        values (
          ${event.payload.episode_revision_id}::uuid,
          ${event.stream_id}::uuid,
          ${event.correlation_id}::uuid,
          ${event.payload.script_id}::uuid,
          ${event.payload.audio_id}::uuid,
          ${event.payload.artwork_id ?? null}::uuid,
          ${event.payload.title},
          ${event.payload.description},
          ${event.occurred_at}::timestamptz
        )
        on conflict (id) do nothing
      `;
      break;

    case "EpisodePublished":
      await sql`
        insert into podcast.episode_publications (
          id, episode_revision_id, published_at, withdrawn_at
        )
        values (
          ${event.payload.publication_id}::uuid,
          ${event.payload.episode_revision_id}::uuid,
          ${event.occurred_at}::timestamptz,
          null
        )
        on conflict (id) do nothing
      `;
      if (event.payload.superseded_publication_id) {
        await sql`
          update podcast.episode_publications
          set withdrawn_at = ${event.occurred_at}::timestamptz
          where id = ${event.payload.superseded_publication_id}::uuid
            and withdrawn_at is null
        `;
      }
      break;

    case "EpisodeWithdrawn":
      await sql`
        update podcast.episode_publications
        set withdrawn_at = ${event.occurred_at}::timestamptz
        where id = ${event.payload.publication_id}::uuid
          and withdrawn_at is null
      `;
      break;

    case "FeedRebuilt":
      await sql`
        insert into podcast.feed_snapshots (id, show_id, blob_id, item_count, built_at)
        values (
          ${event.payload.feed_snapshot_id}::uuid,
          ${event.stream_id}::uuid,
          ${event.payload.blob_id}::uuid,
          ${event.payload.items.length},
          ${event.occurred_at}::timestamptz
        )
        on conflict (id) do nothing
      `;
      for (let i = 0; i < event.payload.items.length; i++) {
        const item = event.payload.items[i]!;
        await sql`
          insert into podcast.feed_items (
            feed_snapshot_id, position, episode_revision_id, guid, pub_date
          )
          values (
            ${event.payload.feed_snapshot_id}::uuid,
            ${i},
            ${item.episode_revision_id}::uuid,
            ${item.guid},
            ${item.pub_date}::timestamptz
          )
          on conflict (feed_snapshot_id, position) do nothing
        `;
      }
      break;

    case "ProductionFailed":
      break;

    default: {
      const _exhaustive: never = event;
      throw new Error(`Unknown event: ${String(_exhaustive)}`);
    }
  }
}

export async function registerBlob(
  sql: SqlExecutor,
  blob: {
    id: string;
    storage_path: string;
    mime_type: string;
    byte_size: number;
    sha256?: string | null;
  },
): Promise<void> {
  await sql`
    insert into podcast.blobs (id, storage_path, mime_type, byte_size, sha256)
    values (
      ${blob.id}::uuid,
      ${blob.storage_path},
      ${blob.mime_type},
      ${blob.byte_size},
      ${blob.sha256 ?? null}
    )
    on conflict (id) do nothing
  `;
}

export async function truncateProjections(sql: SqlExecutor): Promise<void> {
  await sql`truncate table
    podcast.feed_items,
    podcast.feed_snapshots,
    podcast.episode_publications,
    podcast.episode_revisions,
    podcast.artworks,
    podcast.audios,
    podcast.scripts,
    podcast.productions,
    podcast.episodes,
    podcast.article_revisions,
    podcast.articles,
    podcast.shows,
    podcast.blobs
    restart identity cascade`;
}
