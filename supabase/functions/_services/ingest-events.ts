import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  appendEvent,
  nextStreamVersion,
  type Sql,
} from "../_adapters/eventstore/postgres.ts";
import {
  DEFAULT_SHOW_ID,
  type NewDomainEvent,
} from "../_domain/events.ts";
import { getPostgresSql } from "../_shared/postgres.ts";
import { loadConfig } from "../_shared/config.ts";

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildProductionProfile(cfg: Record<string, string>) {
  const pickPrefix = (prefix: string): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(cfg)) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
    }
    return out;
  };
  return {
    generator: pickPrefix("generator."),
    tts: pickPrefix("tts."),
    image: pickPrefix("image."),
    gemini: pickPrefix("gemini."),
  };
}

async function ensureShowConfigured(sql: Sql, cfg: Record<string, string>): Promise<void> {
  const rows = await sql`select 1 from podcast.shows where id = ${DEFAULT_SHOW_ID}::uuid limit 1`;
  if (rows.length > 0) return;

  await appendEvent(sql, {
    type: "ShowConfigured",
    stream_type: "show",
    stream_id: DEFAULT_SHOW_ID,
    stream_version: 1,
    occurred_at: new Date().toISOString(),
    actor: "ingest",
    correlation_id: null,
    payload: {
      show_id: DEFAULT_SHOW_ID,
      title: String(cfg["podcast.title"] ?? "Podcast"),
      description: String(cfg["podcast.description"] ?? ""),
      cover_blob_id: null,
      publication_policy: "auto",
    },
  });
}

export async function ingestViaEvents(
  db: SupabaseClient,
  body: {
    title?: string;
    content: string;
    mem_note_id?: string | null;
    source_url?: string;
    ingest_route?: string | null;
    ingest_meta?: Record<string, unknown>;
    content_path?: string | null;
    content_sha?: string | null;
  },
): Promise<{ article_id: string; episode_id: string; production_id: string }> {
  const sql = getPostgresSql();
  const cfg = await loadConfig();
  await ensureShowConfigured(sql, cfg as Record<string, string>);

  const contentSha = body.content_sha?.trim() || await sha256Hex(body.content);
  const contentPath = body.content_path?.trim() || null;
  const title = body.title?.trim() || "Untitled";
  const occurredAt = new Date().toISOString();

  let articleId: string;
  if (contentPath) {
    const existing = await sql<Array<{ id: string }>>`
      select id from podcast.articles where content_path = ${contentPath} limit 1
    `;
    articleId = existing[0]?.id ?? crypto.randomUUID();
  } else {
    articleId = crypto.randomUUID();
  }

  const articleRevisionId = crypto.randomUUID();
  const articleVersion = await nextStreamVersion(sql, articleId);

  await appendEvent(sql, {
    type: "ArticleRegistered",
    stream_type: "article",
    stream_id: articleId,
    stream_version: articleVersion,
    occurred_at: occurredAt,
    actor: "ingest",
    correlation_id: null,
    payload: {
      article_id: articleId,
      article_revision_id: articleRevisionId,
      content_path: contentPath,
      content_sha: contentSha,
      title,
      content: body.content,
      ingest_route: body.ingest_route ?? null,
      mem_note_id: body.mem_note_id ?? null,
    },
  });

  const [episodeRow] = await sql<Array<{ id: string }>>`
    select id from podcast.episodes where article_id = ${articleId}::uuid limit 1
  `;

  let episodeId = episodeRow?.id;
  let episodeVersion = episodeId ? await nextStreamVersion(sql, episodeId) : 1;
  if (!episodeId) {
    episodeId = crypto.randomUUID();
    episodeVersion = 1;
    await appendEvent(sql, {
      type: "EpisodeOpened",
      stream_type: "episode",
      stream_id: episodeId,
      stream_version: episodeVersion,
      occurred_at: occurredAt,
      actor: "ingest",
      correlation_id: null,
      payload: {
        episode_id: episodeId,
        article_id: articleId,
        show_id: DEFAULT_SHOW_ID,
        guid: episodeId,
      },
    });
  }

  const productionId = crypto.randomUUID();
  const productionVersion = await nextStreamVersion(sql, productionId);

  await appendEvent(sql, {
    type: "ProductionRequested",
    stream_type: "production",
    stream_id: productionId,
    stream_version: productionVersion,
    occurred_at: occurredAt,
    actor: "ingest",
    correlation_id: productionId,
    causation_id: null,
    payload: {
      production_id: productionId,
      episode_id: episodeId,
      article_revision_id: articleRevisionId,
      base_revision_id: null,
      scope: "full",
      trigger: "ingest",
      profile: buildProductionProfile(cfg as Record<string, string>),
    },
  });

  const { processSubscriptionBatch } = await import("../_adapters/eventstore/subscription.ts");
  const { handleProductionPolicyEvent } = await import("./production-policy-handler.ts");
  await processSubscriptionBatch(db, sql, handleProductionPolicyEvent);

  return { article_id: articleId, episode_id: episodeId, production_id: productionId };
}
