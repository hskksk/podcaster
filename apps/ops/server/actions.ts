import { randomUUID } from "node:crypto";
import { buildProductionProfile } from "../../../scripts/lib/production-profile.ts";
import type { ProductionScope } from "../shared/types.ts";
import { HttpError } from "./http-error.ts";
import { assertUuid } from "./queries.ts";
import { remote } from "./remote.ts";

const SCOPES = new Set<ProductionScope>(["full", "audio", "artwork"]);

export function parseScope(value: unknown): ProductionScope {
  if (value === "full" || value === "audio" || value === "artwork") return value;
  throw new HttpError(400, "scope must be full, audio, or artwork.");
}

export async function requeueEpisode(episodeId: string, scope: ProductionScope): Promise<{ productionId: string; wakeStatus: number }> {
  if (!SCOPES.has(scope)) throw new HttpError(400, "scope must be full, audio, or artwork.");
  const id = assertUuid(episodeId);
  const link = remote();
  const db = link.db.schema("podcast");
  const episode = await db.from("episodes").select("article_id").eq("id", id).maybeSingle();
  if (episode.error) throw new HttpError(502, episode.error.message);
  const articleId = (episode.data as { article_id: string } | null)?.article_id;
  if (!articleId) throw new HttpError(404, `Episode not found in podcast.episodes: ${id}`);

  const revision = await db.from("article_revisions").select("id").eq("article_id", articleId).order("registered_at", { ascending: false }).limit(1).maybeSingle();
  if (revision.error) throw new HttpError(502, revision.error.message);
  const articleRevisionId = (revision.data as { id: string } | null)?.id;
  if (!articleRevisionId) {
    throw new HttpError(400, `No article revision for episode ${id}. Run events:backfill first.`);
  }

  let baseRevisionId: string | null = null;
  if (scope !== "full") {
    const base = await db.from("episode_revisions").select("id").eq("episode_id", id).order("assembled_at", { ascending: false }).limit(1).maybeSingle();
    if (base.error) throw new HttpError(502, base.error.message);
    baseRevisionId = (base.data as { id: string } | null)?.id ?? null;
    if (!baseRevisionId) {
      throw new HttpError(400, `No episode revision to reuse for scope=${scope}. Complete a full production first.`);
    }
  }

  const config = await link.db.from("podcast_config").select("key, value");
  if (config.error) throw new HttpError(502, config.error.message);
  const map: Record<string, unknown> = {};
  for (const row of (config.data ?? []) as Array<{ key: string; value: unknown }>) map[row.key] = row.value;
  const profile = buildProductionProfile(map);
  const productionId = randomUUID();
  const occurredAt = new Date().toISOString();
  const inserted = await db.from("productions").insert({
    id: productionId,
    episode_id: id,
    article_revision_id: articleRevisionId,
    base_revision_id: baseRevisionId,
    scope,
    trigger: "manual",
    profile,
    requested_at: occurredAt,
  });
  if (inserted.error) throw new HttpError(502, inserted.error.message);

  const event = await db.from("domain_events").insert({
    id: randomUUID(),
    type: "ProductionRequested",
    stream_type: "production",
    stream_id: productionId,
    stream_version: 1,
    occurred_at: occurredAt,
    actor: "manual",
    correlation_id: productionId,
    causation_id: null,
    payload: {
      production_id: productionId,
      episode_id: id,
      article_revision_id: articleRevisionId,
      base_revision_id: baseRevisionId,
      scope,
      trigger: "manual",
      profile,
    },
  });
  if (event.error) {
    await db.from("productions").delete().eq("id", productionId);
    throw new HttpError(502, event.error.message);
  }
  const wakeStatus = await wakeSubscriber(link.apiUrl, link.serviceKey);
  return { productionId, wakeStatus };
}

export async function publishEpisode(episodeId: string): Promise<{ body: string }> {
  const id = assertUuid(episodeId);
  const link = remote();
  const revision = await link.db.schema("podcast").from("episode_revisions").select("id").eq("episode_id", id).order("assembled_at", { ascending: false }).limit(1).maybeSingle();
  if (revision.error) throw new HttpError(502, revision.error.message);
  const revisionId = (revision.data as { id: string } | null)?.id;
  if (!revisionId) throw new HttpError(400, "No assembled version to publish.");
  const res = await fetch(`${link.apiUrl}/functions/v1/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${link.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "publish",
      episode_id: id,
      episode_revision_id: revisionId,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new HttpError(res.status, `publish failed: ${body}`);
  return { body };
}

async function wakeSubscriber(apiUrl: string, serviceKey: string): Promise<number> {
  const res = await fetch(`${apiUrl}/functions/v1/domain-subscriber`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}` },
  });
  return res.status;
}

const SAFE_PATH = /^[\w./-]+$/;

export async function readMedia(path: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (!path || path.includes("..") || !SAFE_PATH.test(path)) {
    throw new HttpError(400, "Storage path is not allowed.");
  }
  const link = remote();
  const { data, error } = await link.db.storage.from("podcast").download(path);
  if (error || !data) throw new HttpError(404, error?.message ?? "Object was not found.");
  return {
    bytes: new Uint8Array(await data.arrayBuffer()),
    contentType: data.type || "application/octet-stream",
  };
}
