#!/usr/bin/env tsx
/**
 * Legacy public.* rows → podcast.domain_events (actor = migration).
 * Idempotent: re-run stops on stream_version unique violations.
 */
import { createHash, randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  appendEvent,
  nextStreamVersion,
  StreamVersionConflictError,
} from "../supabase/functions/_adapters/eventstore/postgres.ts";
import {
  DEFAULT_SHOW_ID,
  type NewDomainEvent,
} from "../supabase/functions/_domain/events.ts";
import { registerBlob } from "../supabase/functions/_adapters/eventstore/projections.ts";
import { connectPostgres } from "./lib/postgres-connect.ts";
import { legacyPipelineTablesExist } from "./lib/legacy-tables.ts";
import {
  buildProductionProfile,
  loadPodcastConfigMap,
} from "./lib/production-profile.ts";
import { detectLocalStatus, detectProjectRef, detectServiceKey } from "./lib/supabase-detect.ts";
import { wavDurationMs } from "./lib/wav-duration.ts";

dotenv.config({ path: ".env" });

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function storagePathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/podcast/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

/** Legacy episodes.image_url is usually a bucket path, not a public URL. */
function resolveEpisodeImageStoragePath(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const fromPublic = storagePathFromPublicUrl(trimmed);
  if (fromPublic) return fromPublic;
  if (/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/^\/+/, "");
}

function mimeTypeForStoragePath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function artworkStorageCandidates(
  sql: ReturnType<typeof connectPostgres>,
  legacyEp: EpisodeRow,
): Promise<Array<{ path: string; occurredAt: Date }>> {
  const candidates: Array<{ path: string; occurredAt: Date }> = [];
  const push = (path: string, occurredAt: Date) => {
    if (candidates.some((c) => c.path === path)) return;
    candidates.push({ path, occurredAt });
  };

  const fromUrl = resolveEpisodeImageStoragePath(legacyEp.image_url);
  if (fromUrl) push(fromUrl, legacyEp.created_at);

  const logs = await sql<Array<{ processed_at: Date }>>`
    select processed_at
    from legacy_processing_logs
    where episode_id = ${legacyEp.id}::uuid
      and queue_name = 'generateEpisodeImage'
      and status = 'success'
    order by processed_at desc
    limit 1
  `;
  const log = logs[0];
  if (log) {
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
      push(`episodes/${legacyEp.id}/cover.${ext}`, log.processed_at);
    }
  }

  return candidates;
}

async function appendArtworkIfStored(
  ctx: {
    sql: ReturnType<typeof connectPostgres>;
    storage: { from: (bucket: string) => { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } };
    tryAppend: (event: NewDomainEvent) => Promise<void>;
    legacyEp: EpisodeRow;
    scriptId: string;
    productionId: string;
  },
): Promise<string | null> {
  const candidates = await artworkStorageCandidates(ctx.sql, ctx.legacyEp);
  for (const candidate of candidates) {
    try {
      const { data, error } = await ctx.storage.from("podcast").download(candidate.path);
      if (error || !data) continue;
      const bytes = new Uint8Array(await data.arrayBuffer());
      const blobId = randomUUID();
      const artworkId = randomUUID();
      await registerBlob(ctx.sql, {
        id: blobId,
        storage_path: candidate.path,
        mime_type: mimeTypeForStoragePath(candidate.path),
        byte_size: bytes.byteLength,
      });
      await ctx.tryAppend({
        type: "ArtworkPainted",
        stream_type: "production",
        stream_id: ctx.productionId,
        stream_version: await nextStreamVersion(ctx.sql, ctx.productionId),
        occurred_at: candidate.occurredAt.toISOString(),
        actor: "migration",
        correlation_id: ctx.productionId,
        payload: {
          artwork_id: artworkId,
          job_id: null,
          script_id: ctx.scriptId,
          blob_id: blobId,
        },
      });
      return artworkId;
    } catch {
      // try next candidate path
    }
  }
  return null;
}

type EpisodeRow = {
  id: string;
  article_id: string | null;
  title: string;
  description: string;
  status: string;
  image_url: string | null;
  audio_url: string | null;
  published_at: Date | null;
  created_at: Date;
};

function pickCanonicalEpisode(eps: EpisodeRow[]): EpisodeRow {
  const byCreated = [...eps].sort(
    (a, b) => a.created_at.getTime() - b.created_at.getTime(),
  );
  const published = byCreated.filter((e) => e.status === "published");
  if (published.length > 0) {
    return published.sort(
      (a, b) => (b.published_at?.getTime() ?? 0) - (a.published_at?.getTime() ?? 0),
    )[0]!;
  }
  return byCreated[byCreated.length - 1]!;
}

async function validateLegacy(sql: ReturnType<typeof connectPostgres>): Promise<void> {
  const multiEpisode = await sql<Array<{ article_id: string; n: string }>>`
    select article_id, count(*)::text as n
    from legacy_episodes
    where article_id is not null
    group by article_id
    having count(*) > 1
  `;
  if (multiEpisode.length > 0) {
    console.warn(
      "1 article に複数 episodes があります。canonical episode 1 本 + 複数 episode revision として移行します:\n" +
        multiEpisode.map((r) => `  ${r.article_id} (${r.n} rows)`).join("\n"),
    );
  }

  const dupNullPath = await sql<Array<{ n: string }>>`
    select count(*)::text as n
    from (
      select title, content_sha
      from legacy_articles
      where content_path is null
      group by title, content_sha
      having count(*) > 1
    ) t
  `;
  if (Number(dupNullPath[0]?.n ?? 0) > 0) {
    console.warn(
      "content_path が null の重複記事があります。backfill は続行しますが、要確認です。",
    );
  }
}

async function main(): Promise<void> {
  const sql = connectPostgres();
  if (!(await legacyPipelineTablesExist(sql))) {
    console.log(
      "legacy_* tables are gone. events:backfill only applies before the drop migration; nothing to do.",
    );
    await sql.end();
    return;
  }
  const target = process.env.TARGET ?? "local";
  let storageUrl: string;
  let serviceKey: string;
  if (target === "local") {
    const local = detectLocalStatus();
    storageUrl = local.apiUrl;
    serviceKey = local.serviceKey;
  } else {
    const projectRef = detectProjectRef();
    storageUrl = process.env.SUPABASE_URL ?? `https://${projectRef}.supabase.co`;
    serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? detectServiceKey(projectRef);
  }
  const storage = createClient(storageUrl, serviceKey, {
    auth: { persistSession: false },
  }).storage;

  await validateLegacy(sql);
  const configMap = await loadPodcastConfigMap(sql);
  const profile = buildProductionProfile(configMap);

  const title = String(configMap["podcast.title"] ?? "Podcast");
  const description = String(configMap["podcast.description"] ?? "");
  const coverUrl = String(configMap["podcast.cover_url"] ?? "");
  const coverPath = storagePathFromPublicUrl(coverUrl) ?? "cover.png";

  let coverBlobId: string | null = null;
  try {
    const { data, error } = await storage.from("podcast").download(coverPath);
    if (!error && data) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      coverBlobId = randomUUID();
      await registerBlob(sql, {
        id: coverBlobId,
        storage_path: coverPath,
        mime_type: "image/png",
        byte_size: bytes.byteLength,
      });
    }
  } catch {
    // cover optional
  }

  let appended = 0;
  let skipped = 0;

  async function tryAppend(event: NewDomainEvent): Promise<void> {
    try {
      const stored = await appendEvent(sql, event);
      appended++;
    } catch (err) {
      if (err instanceof StreamVersionConflictError) {
        skipped++;
        return;
      }
      throw err;
    }
  }

  await tryAppend({
    type: "ShowConfigured",
    stream_type: "show",
    stream_id: DEFAULT_SHOW_ID,
    stream_version: 1,
    occurred_at: new Date().toISOString(),
    actor: "migration",
    correlation_id: null,
    payload: {
      show_id: DEFAULT_SHOW_ID,
      title,
      description,
      cover_blob_id: coverBlobId,
      publication_policy: "auto",
    },
  });

  type ArticleRow = {
    id: string;
    title: string;
    content: string;
    content_path: string | null;
    content_sha: string | null;
    ingest_route: string | null;
    mem_note_id: string | null;
    created_at: Date;
  };

  const articles = await sql<ArticleRow[]>`
    select id, title, content, content_path, content_sha, ingest_route, mem_note_id, created_at
    from legacy_articles
    order by created_at asc
  `;

  const episodes = await sql<EpisodeRow[]>`
    select id, article_id, title, description, status, image_url, audio_url, published_at, created_at
    from legacy_episodes
    order by created_at asc
  `;

  const episodesByArticle = new Map<string, EpisodeRow[]>();
  for (const ep of episodes) {
    if (!ep.article_id) continue;
    const list = episodesByArticle.get(ep.article_id) ?? [];
    list.push(ep);
    episodesByArticle.set(ep.article_id, list);
  }

  const revisionByEpisode = new Map<string, string>();

  for (const article of articles) {
    const migrated = await sql`
      select 1 from podcast.domain_events
      where stream_type = 'article' and stream_id = ${article.id}::uuid and stream_version = 1
      limit 1
    `;
    const articleAlreadyRegistered = migrated.length > 0;

    const contentSha = article.content_sha ?? sha256(article.content);
    const articleRevisionId = article.id;

    if (!articleAlreadyRegistered) {
      await tryAppend({
        type: "ArticleRegistered",
        stream_type: "article",
        stream_id: article.id,
        stream_version: 1,
        occurred_at: article.created_at.toISOString(),
        actor: "migration",
        correlation_id: null,
        payload: {
          article_id: article.id,
          article_revision_id: articleRevisionId,
          content_path: article.content_path,
          content_sha: contentSha,
          title: article.title,
          content: article.content,
          ingest_route: article.ingest_route,
          mem_note_id: article.mem_note_id,
        },
      });
    }

    const legacyEpisodes = episodesByArticle.get(article.id);
    if (!legacyEpisodes?.length) continue;

    const canonical = pickCanonicalEpisode(legacyEpisodes);
    const canonicalEpisodeId = canonical.id;
    const sortedLegacy = [...legacyEpisodes].sort(
      (a, b) => a.created_at.getTime() - b.created_at.getTime(),
    );

    const opened = await sql`
      select 1 from podcast.domain_events
      where stream_type = 'episode' and stream_id = ${canonicalEpisodeId}::uuid
        and type = 'EpisodeOpened'
      limit 1
    `;
    if (opened.length === 0) {
      const openProductionId = randomUUID();
      await tryAppend({
        type: "EpisodeOpened",
        stream_type: "episode",
        stream_id: canonicalEpisodeId,
        stream_version: await nextStreamVersion(sql, canonicalEpisodeId),
        occurred_at: sortedLegacy[0]!.created_at.toISOString(),
        actor: "migration",
        correlation_id: openProductionId,
        payload: {
          episode_id: canonicalEpisodeId,
          article_id: article.id,
          show_id: DEFAULT_SHOW_ID,
          guid: canonicalEpisodeId,
        },
      });
    }

    let supersededPublicationId: string | null = null;

    for (const legacyEp of sortedLegacy) {
      const productionId = randomUUID();
      let streamProduction = 1;

      await tryAppend({
        type: "ProductionRequested",
        stream_type: "production",
        stream_id: productionId,
        stream_version: streamProduction++,
        occurred_at: legacyEp.created_at.toISOString(),
        actor: "migration",
        correlation_id: productionId,
        payload: {
          production_id: productionId,
          episode_id: canonicalEpisodeId,
          article_revision_id: articleRevisionId,
          base_revision_id: null,
          scope: "full",
          trigger: "migration",
          profile,
        },
      });

      const scripts = await sql<
        Array<{ id: string; content: string; created_at: Date }>
      >`
        select id, content, created_at
        from legacy_scripts
        where episode_id = ${legacyEp.id}::uuid and status = 'ready'
        order by created_at desc
        limit 1
      `;
      const script = scripts[0];
      if (!script) continue;

      const scriptId = script.id;

      const existingRevision = await sql<
        Array<{ revision_id: string; production_id: string; artwork_id: string | null }>
      >`
        select er.id as revision_id, er.production_id, er.artwork_id
        from podcast.episode_revisions er
        where er.episode_id = ${canonicalEpisodeId}::uuid
          and er.script_id = ${scriptId}::uuid
        limit 1
      `;
      if (existingRevision[0]) {
        const row = existingRevision[0];
        revisionByEpisode.set(legacyEp.id, row.revision_id);
        revisionByEpisode.set(canonicalEpisodeId, row.revision_id);
        if (!row.artwork_id) {
          const artworkId = await appendArtworkIfStored({
            sql,
            storage,
            tryAppend,
            legacyEp,
            scriptId,
            productionId: row.production_id,
          });
          if (artworkId) {
            await sql`
              update podcast.episode_revisions
              set artwork_id = ${artworkId}::uuid
              where id = ${row.revision_id}::uuid
            `;
          }
        }
        continue;
      }

      await tryAppend({
        type: "ScriptWritten",
        stream_type: "production",
        stream_id: productionId,
        stream_version: streamProduction++,
        occurred_at: script.created_at.toISOString(),
        actor: "migration",
        correlation_id: productionId,
        payload: {
          script_id: scriptId,
          job_id: null,
          title: legacyEp.title,
          description: legacyEp.description,
          content: script.content,
        },
      });

      const audios = await sql<
        Array<{ id: string; storage_path: string; mime_type: string; script_id: string | null; created_at: Date }>
      >`
        select id, storage_path, mime_type, script_id, created_at
        from legacy_audio_files
        where episode_id = ${legacyEp.id}::uuid and status = 'ready'
        order by created_at desc
        limit 1
      `;
      const audio = audios[0];
      if (!audio) continue;

      const linkedScriptId = audio.script_id ?? scriptId;
      try {
        const { data, error } = await storage.from("podcast").download(audio.storage_path);
        if (!error && data) {
          const bytes = new Uint8Array(await data.arrayBuffer());
          const durationMs = wavDurationMs(bytes) ?? 0;
          const blobId = randomUUID();
          await registerBlob(sql, {
            id: blobId,
            storage_path: audio.storage_path,
            mime_type: audio.mime_type,
            byte_size: bytes.byteLength,
          });
          await tryAppend({
            type: "AudioRendered",
            stream_type: "production",
            stream_id: productionId,
            stream_version: streamProduction++,
            occurred_at: audio.created_at.toISOString(),
            actor: "migration",
            correlation_id: productionId,
            payload: {
              audio_id: audio.id,
              job_id: null,
              script_id: linkedScriptId,
              blob_id: blobId,
              duration_ms: durationMs,
              casting: {},
            },
          });
        }
      } catch {
        // skip audio event if storage missing
      }

      let artworkId: string | null = await appendArtworkIfStored({
        sql,
        storage,
        tryAppend,
        legacyEp,
        scriptId,
        productionId,
      });

      const audioRows = await sql<Array<{ id: string }>>`
        select id from podcast.audios where production_id = ${productionId}::uuid limit 1
      `;
      const audioId = audioRows[0]?.id ?? audio.id;
      const episodeRevisionId = randomUUID();

      await tryAppend({
        type: "EpisodeAssembled",
        stream_type: "episode",
        stream_id: canonicalEpisodeId,
        stream_version: await nextStreamVersion(sql, canonicalEpisodeId),
        occurred_at: audio.created_at.toISOString(),
        actor: "migration",
        correlation_id: productionId,
        payload: {
          episode_revision_id: episodeRevisionId,
          script_id: scriptId,
          audio_id: audioId,
          artwork_id: artworkId,
          title: legacyEp.title,
          description: legacyEp.description,
        },
      });

      revisionByEpisode.set(legacyEp.id, episodeRevisionId);
      revisionByEpisode.set(canonicalEpisodeId, episodeRevisionId);

      if (legacyEp.status === "published" && legacyEp.published_at) {
        const publicationId = randomUUID();
        await tryAppend({
          type: "EpisodePublished",
          stream_type: "episode",
          stream_id: canonicalEpisodeId,
          stream_version: await nextStreamVersion(sql, canonicalEpisodeId),
          occurred_at: legacyEp.published_at.toISOString(),
          actor: "migration",
          correlation_id: productionId,
          payload: {
            publication_id: publicationId,
            episode_revision_id: episodeRevisionId,
            superseded_publication_id: supersededPublicationId,
          },
        });
        supersededPublicationId = publicationId;
      }
    }
  }

  // feed.xml snapshot (optional)
  try {
    const { data, error } = await storage.from("podcast").download("feed.xml");
    if (!error && data) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      const xml = new TextDecoder().decode(bytes);
      const blobId = randomUUID();
      const feedSnapshotId = randomUUID();
      await registerBlob(sql, {
        id: blobId,
        storage_path: "feed.xml",
        mime_type: "application/xml",
        byte_size: bytes.byteLength,
      });

      const items: Array<{ episode_revision_id: string; guid: string; pub_date: string }> = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match: RegExpExecArray | null;
      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1]!;
        const guid = block.match(/<guid[^>]*>([^<]+)<\/guid>/i)?.[1]?.trim();
        const pubDate = block.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1]?.trim();
        if (!guid || !pubDate) continue;
        const revisionId = revisionByEpisode.get(guid);
        if (!revisionId) continue;
        items.push({
          episode_revision_id: revisionId,
          guid,
          pub_date: new Date(pubDate).toISOString(),
        });
      }

      await tryAppend({
        type: "FeedRebuilt",
        stream_type: "show",
        stream_id: DEFAULT_SHOW_ID,
        stream_version: 2,
        occurred_at: new Date().toISOString(),
        actor: "migration",
        correlation_id: null,
        payload: {
          feed_snapshot_id: feedSnapshotId,
          blob_id: blobId,
          items,
        },
      });
    }
  } catch {
    // feed optional
  }

  console.log(`Backfill complete. appended=${appended} skipped(conflicts)=${skipped}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
