import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildRssFeedXml, type FeedEpisodeItem } from "../_adapters/feed/build-rss.ts";
import { registerBlob } from "../_adapters/eventstore/projections.ts";
import type { Sql } from "../_adapters/eventstore/postgres.ts";
import { appendDomainEvents } from "../_adapters/eventstore/subscription.ts";
import { DEFAULT_SHOW_ID } from "../_domain/events.ts";
import { loadConfig } from "../_shared/config.ts";

type FeedRow = FeedEpisodeItem & { episodeRevisionId: string };

export async function publishEpisodeRevision(
  db: SupabaseClient,
  sql: Sql,
  opts: {
    episodeId: string;
    episodeRevisionId: string;
    actor: string;
    causationEventId: string;
    withdraw?: boolean;
    publicationId?: string;
  },
): Promise<void> {
  if (opts.withdraw && opts.publicationId) {
    await withdrawPublication(db, sql, {
      publicationId: opts.publicationId,
      actor: opts.actor,
      causationEventId: opts.causationEventId,
    });
    return;
  }

  const cfg = await loadConfig();
  const storageUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/podcast`;
  const occurredAt = new Date().toISOString();

  const pendingRow = await loadFeedRowForRevision(sql, opts.episodeRevisionId, occurredAt);
  if (!pendingRow) throw new Error(`publish: revision not found ${opts.episodeRevisionId}`);

  const existing = await loadPublishedFeedItems(sql);
  const withoutEpisode = existing.filter((row) => row.guid !== pendingRow.guid);
  const feedItems = [pendingRow, ...withoutEpisode].sort(
    (a, b) => new Date(b.pubDateIso).getTime() - new Date(a.pubDateIso).getTime(),
  );

  await uploadFeed(db, sql, feedItems, cfg as Record<string, string>, storageUrl, {
    actor: opts.actor,
    causationEventId: opts.causationEventId,
    occurredAt,
    episodeId: opts.episodeId,
    episodeRevisionId: opts.episodeRevisionId,
  });
}

async function withdrawPublication(
  db: SupabaseClient,
  sql: Sql,
  opts: { publicationId: string; actor: string; causationEventId: string },
): Promise<void> {
  const [ep] = await sql<Array<{ episode_id: string }>>`
    select er.episode_id
    from podcast.episode_publications pub
    join podcast.episode_revisions er on er.id = pub.episode_revision_id
    where pub.id = ${opts.publicationId}::uuid
    limit 1
  `;
  if (!ep) throw new Error(`withdraw: publication not found ${opts.publicationId}`);

  const cfg = await loadConfig();
  const storageUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/podcast`;
  const occurredAt = new Date().toISOString();

  await appendDomainEvents(sql, [{
    type: "EpisodeWithdrawn",
    stream_type: "episode",
    stream_id: ep.episode_id,
    stream_version: 0,
    occurred_at: occurredAt,
    actor: opts.actor,
    correlation_id: opts.publicationId,
    causation_id: opts.causationEventId,
    payload: {
      publication_id: opts.publicationId,
      reason: "manual",
    },
  }]);

  const feedItems = await loadPublishedFeedItems(sql);
  const feedSnapshotId = crypto.randomUUID();
  const blobId = crypto.randomUUID();
  await writeFeedFiles(db, sql, feedItems, cfg as Record<string, string>, storageUrl, feedSnapshotId, blobId);

  await appendDomainEvents(sql, [{
    type: "FeedRebuilt",
    stream_type: "show",
    stream_id: DEFAULT_SHOW_ID,
    stream_version: 0,
    occurred_at: occurredAt,
    actor: opts.actor,
    correlation_id: opts.publicationId,
    causation_id: opts.causationEventId,
    payload: {
      feed_snapshot_id: feedSnapshotId,
      blob_id: blobId,
      items: feedItems.map((item) => ({
        episode_revision_id: item.episodeRevisionId,
        guid: item.guid,
        pub_date: item.pubDateIso,
      })),
    },
  }]);
}

async function uploadFeed(
  db: SupabaseClient,
  sql: Sql,
  feedItems: FeedRow[],
  cfg: Record<string, string>,
  storageUrl: string,
  meta: {
    actor: string;
    causationEventId: string;
    occurredAt: string;
    episodeId: string;
    episodeRevisionId: string;
  },
): Promise<void> {
  const feedSnapshotId = crypto.randomUUID();
  const blobId = crypto.randomUUID();
  await writeFeedFiles(db, sql, feedItems, cfg, storageUrl, feedSnapshotId, blobId);

  const [prevPub] = await sql<Array<{ id: string }>>`
    select pub.id
    from podcast.episode_publications pub
    join podcast.episode_revisions er on er.id = pub.episode_revision_id
    where er.episode_id = ${meta.episodeId}::uuid
      and pub.withdrawn_at is null
    order by pub.published_at desc
    limit 1
  `;

  const publicationId = crypto.randomUUID();
  await appendDomainEvents(sql, [
    {
      type: "EpisodePublished",
      stream_type: "episode",
      stream_id: meta.episodeId,
      stream_version: 0,
      occurred_at: meta.occurredAt,
      actor: meta.actor,
      correlation_id: meta.episodeRevisionId,
      causation_id: meta.causationEventId,
      payload: {
        publication_id: publicationId,
        episode_revision_id: meta.episodeRevisionId,
        superseded_publication_id: prevPub?.id ?? null,
      },
    },
    {
      type: "FeedRebuilt",
      stream_type: "show",
      stream_id: DEFAULT_SHOW_ID,
      stream_version: 0,
      occurred_at: meta.occurredAt,
      actor: meta.actor,
      correlation_id: publicationId,
      causation_id: meta.causationEventId,
      payload: {
        feed_snapshot_id: feedSnapshotId,
        blob_id: blobId,
        items: feedItems.map((item) => ({
          episode_revision_id: item.episodeRevisionId,
          guid: item.guid,
          pub_date: item.pubDateIso,
        })),
      },
    },
  ]);
}

async function writeFeedFiles(
  db: SupabaseClient,
  sql: Sql,
  feedItems: FeedRow[],
  cfg: Record<string, string>,
  storageUrl: string,
  feedSnapshotId: string,
  blobId: string,
): Promise<void> {
  const xml = buildRssFeedXml(feedItems, cfg, storageUrl);
  const xmlBytes = new TextEncoder().encode(xml);
  const versionedPath = `feeds/${feedSnapshotId}.xml`;

  const { error: uploadErr } = await db.storage.from("podcast").upload(versionedPath, xmlBytes, {
    contentType: "application/rss+xml",
    upsert: true,
  });
  if (uploadErr) throw new Error(`feed upload: ${uploadErr.message}`);

  const { error: publicErr } = await db.storage.from("podcast").upload("feed.xml", xmlBytes, {
    contentType: "application/rss+xml",
    upsert: true,
  });
  if (publicErr) throw new Error(`feed.xml upload: ${publicErr.message}`);

  await registerBlob(sql, {
    id: blobId,
    storage_path: versionedPath,
    mime_type: "application/rss+xml",
    byte_size: xmlBytes.byteLength,
  });
}

async function loadFeedRowForRevision(
  sql: Sql,
  episodeRevisionId: string,
  pubDateIso: string,
): Promise<FeedRow | null> {
  const rows = await sql<Array<{
    episode_revision_id: string;
    guid: string;
    title: string;
    description: string;
    storage_path: string;
    mime_type: string;
    byte_size: string;
    image_path: string | null;
    article_title: string;
  }>>`
    select
      er.id as episode_revision_id,
      e.guid,
      er.title,
      er.description,
      b.storage_path,
      b.mime_type,
      b.byte_size::text,
      ib.storage_path as image_path,
      ar.title as article_title
    from podcast.episode_revisions er
    join podcast.episodes e on e.id = er.episode_id
    join podcast.audios au on au.id = er.audio_id
    join podcast.blobs b on b.id = au.blob_id
    left join podcast.artworks aw on aw.id = er.artwork_id
    left join podcast.blobs ib on ib.id = aw.blob_id
    join podcast.productions p on p.id = er.production_id
    join podcast.article_revisions ar on ar.id = p.article_revision_id
    where er.id = ${episodeRevisionId}::uuid
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    episodeRevisionId: row.episode_revision_id,
    guid: row.guid,
    title: row.title,
    description: row.description,
    pubDateIso,
    audioStoragePath: row.storage_path,
    audioMimeType: row.mime_type,
    audioByteSize: Number(row.byte_size),
    imageStoragePath: row.image_path,
    articleTitle: row.article_title,
  };
}

async function loadPublishedFeedItems(sql: Sql): Promise<FeedRow[]> {
  const rows = await sql<Array<{
    episode_revision_id: string;
    guid: string;
    title: string;
    description: string;
    published_at: Date;
    storage_path: string;
    mime_type: string;
    byte_size: string;
    image_path: string | null;
    article_title: string;
  }>>`
    select
      er.id as episode_revision_id,
      e.guid,
      er.title,
      er.description,
      pub.published_at,
      b.storage_path,
      b.mime_type,
      b.byte_size::text,
      ib.storage_path as image_path,
      ar.title as article_title
    from podcast.episode_publications pub
    join podcast.episode_revisions er on er.id = pub.episode_revision_id
    join podcast.episodes e on e.id = er.episode_id
    join podcast.audios au on au.id = er.audio_id
    join podcast.blobs b on b.id = au.blob_id
    left join podcast.artworks aw on aw.id = er.artwork_id
    left join podcast.blobs ib on ib.id = aw.blob_id
    join podcast.productions p on p.id = er.production_id
    join podcast.article_revisions ar on ar.id = p.article_revision_id
    where pub.withdrawn_at is null
    order by pub.published_at desc
  `;

  return rows.map((row) => ({
    episodeRevisionId: row.episode_revision_id,
    guid: row.guid,
    title: row.title,
    description: row.description,
    pubDateIso: row.published_at.toISOString(),
    audioStoragePath: row.storage_path,
    audioMimeType: row.mime_type,
    audioByteSize: Number(row.byte_size),
    imageStoragePath: row.image_path,
    articleTitle: row.article_title,
  }));
}
