import { connectPostgres } from "./postgres-connect.ts";
import {
  appendManualProductionRequested,
  latestAssembledRevisionId,
} from "./request-production.ts";
import {
  detectLocalStatus,
  detectProjectRef,
  detectServiceKey,
} from "./supabase-detect.ts";

export async function wakeDomainSubscriber(): Promise<void> {
  const target = process.env.TARGET ?? "remote";
  let url: string;
  let key: string;
  if (target === "local") {
    const local = detectLocalStatus();
    url = `${local.apiUrl}/functions/v1/domain-subscriber`;
    key = local.serviceKey;
  } else {
    const ref = detectProjectRef();
    key = detectServiceKey(ref);
    url = `https://${ref}.supabase.co/functions/v1/domain-subscriber`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.warn(`domain-subscriber wake returned ${res.status}: ${await res.text()}`);
  }
}

export async function publishEpisodeViaEdge(
  episodeId: string,
  episodeRevisionId: string,
): Promise<{ ok: boolean; body: string; status: number }> {
  const target = process.env.TARGET ?? "remote";
  let url: string;
  let key: string;
  if (target === "local") {
    const local = detectLocalStatus();
    url = `${local.apiUrl}/functions/v1/publish`;
    key = local.serviceKey;
  } else {
    const ref = detectProjectRef();
    key = detectServiceKey(ref);
    url = `https://${ref}.supabase.co/functions/v1/publish`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "publish",
      episode_id: episodeId,
      episode_revision_id: episodeRevisionId,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, body, status: res.status };
}

export async function resolveLatestRevisionId(episodeId: string): Promise<string | null> {
  const sql = connectPostgres();
  const revisionId = await latestAssembledRevisionId(sql, episodeId);
  await sql.end();
  return revisionId;
}

export async function appendProductionRequeue(
  episodeId: string,
  scope: "full" | "audio" | "artwork",
): Promise<string> {
  const sql = connectPostgres();
  const productionId = await appendManualProductionRequested(sql, { episodeId, scope });
  await sql.end();
  await wakeDomainSubscriber();
  return productionId;
}
