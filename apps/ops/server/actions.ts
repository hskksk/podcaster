import { createClient } from "@supabase/supabase-js";
import { appendManualProductionRequested } from "../../../scripts/lib/request-production.ts";
import type { ProductionScope } from "../shared/types.ts";
import { HttpError } from "./http-error.ts";
import { localApi, sqlClient } from "./local-db.ts";
import { assertUuid } from "./queries.ts";

const SCOPES = new Set<ProductionScope>(["full", "audio", "artwork"]);

export function parseScope(value: unknown): ProductionScope {
  if (value === "full" || value === "audio" || value === "artwork") return value;
  throw new HttpError(400, "scope must be full, audio, or artwork.");
}

export async function requeueEpisode(episodeId: string, scope: ProductionScope): Promise<{ productionId: string; wakeStatus: number }> {
  if (!SCOPES.has(scope)) throw new HttpError(400, "scope must be full, audio, or artwork.");
  const id = assertUuid(episodeId);
  const productionId = await appendManualProductionRequested(sqlClient(), { episodeId: id, scope });
  const wakeStatus = await wakeSubscriber();
  return { productionId, wakeStatus };
}

export async function publishEpisode(episodeId: string): Promise<{ body: string }> {
  const id = assertUuid(episodeId);
  const [revision] = await sqlClient()<Array<{ id: string }>>`
    select id
    from podcast.episode_revisions
    where episode_id = ${id}::uuid
    order by assembled_at desc
    limit 1
  `;
  if (!revision) throw new HttpError(400, "No assembled version to publish.");
  const { apiUrl, serviceKey } = localApi();
  const res = await fetch(`${apiUrl}/functions/v1/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "publish",
      episode_id: id,
      episode_revision_id: revision.id,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new HttpError(res.status, `publish failed: ${body}`);
  return { body };
}

async function wakeSubscriber(): Promise<number> {
  const { apiUrl, serviceKey } = localApi();
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
  const { apiUrl, serviceKey } = localApi();
  const db = createClient(apiUrl, serviceKey);
  const { data, error } = await db.storage.from("podcast").download(path);
  if (error || !data) throw new HttpError(404, error?.message ?? "Object was not found.");
  return {
    bytes: new Uint8Array(await data.arrayBuffer()),
    contentType: data.type || "application/octet-stream",
  };
}
