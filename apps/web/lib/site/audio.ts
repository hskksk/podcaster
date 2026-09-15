import "server-only";

import { projectRef } from "./config";

function supabaseUrl(): string {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL.replace(/\/$/, "");
  const ref = projectRef();
  return ref ? `https://${ref}.supabase.co` : "";
}

function serviceKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

/**
 * legacyFilename / inbox_file basename → public audio URL.
 * Server-only. Missing credentials → empty map (pages still render).
 */
export async function fetchArticleAudioMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const url = supabaseUrl();
  const key = serviceKey();
  const ref = projectRef();
  if (!url || !key || !ref) return map;

  const endpoint = `${url}/rest/v1/episodes?select=audio_url,articles(ingest_meta,content_path)&audio_url=not.is.null`;
  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      console.warn("audio map fetch failed", res.status, await res.text().catch(() => ""));
      return map;
    }
    const rows = (await res.json()) as Array<{
      audio_url: string | null;
      articles: {
        ingest_meta?: { inbox_file?: string; legacyFilename?: string } | null;
        content_path?: string | null;
      } | null;
    }>;
    const storageBase = `https://${ref}.supabase.co/storage/v1/object/public/podcast`;
    for (const row of rows) {
      if (!row.audio_url) continue;
      const audio = row.audio_url.startsWith("http")
        ? row.audio_url
        : `${storageBase}/${row.audio_url.replace(/^\//, "")}`;
      const meta = row.articles?.ingest_meta ?? {};
      const keys = [meta.inbox_file, meta.legacyFilename, row.articles?.content_path].filter(
        (k): k is string => Boolean(k),
      );
      for (const k of keys) {
        map.set(k, audio);
        map.set(k.split("/").pop() ?? k, audio);
      }
    }
  } catch (err) {
    console.warn("audio map unavailable", err);
  }
  return map;
}

export function audioForDoc(
  map: Map<string, string>,
  filename: string,
): string | undefined {
  const base = filename.split("/").pop() ?? filename;
  return map.get(filename) ?? map.get(base);
}
