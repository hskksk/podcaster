import "server-only";

import { feedUrl, projectRef } from "./config";
import type { PublicDoc } from "./docs";

function supabaseUrl(): string {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL.replace(/\/$/, "");
  const ref = projectRef();
  return ref ? `https://${ref}.supabase.co` : "";
}

function serviceKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function registerAudioKey(map: Map<string, string>, key: string, audio: string) {
  if (!key) return;
  map.set(key, audio);
  const base = key.split("/").pop();
  if (base && base !== key) map.set(base, audio);

  const docDir = key.match(/content\/docs\/([^/]+)\/index\.mdoc/);
  if (docDir?.[1]) map.set(docDir[1], audio);
}

type ArticleJoin = {
  ingest_meta?: { inbox_file?: string; legacyFilename?: string } | null;
  content_path?: string | null;
} | null;

function articleJoin(row: { articles: ArticleJoin | ArticleJoin[] | null }): ArticleJoin {
  const a = row.articles;
  if (!a) return null;
  if (Array.isArray(a)) return a[0] ?? null;
  return a;
}

function decodeXml(s: string): string {
  // Decode &amp; last to avoid double-unescaping (CodeQL js/double-escaping).
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, "&");
}

function tagText(block: string, tag: string): string | undefined {
  const re = new RegExp(
    `<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`,
    "i",
  );
  const m = block.match(re);
  const raw = m?.[1] ?? m?.[2];
  return raw != null ? decodeXml(raw.trim()) : undefined;
}

/** Public RSS — no service role required (Vercel build fallback). */
async function fetchArticleAudioMapFromRss(rssUrl: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch(rssUrl, { cache: "force-cache" });
    if (!res.ok) {
      console.warn("audio map RSS fetch failed", res.status);
      return map;
    }
    const xml = await res.text();
    for (const block of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
      const item = block[1] ?? "";
      const enc = item.match(/<enclosure[^>]+url="([^"]+)"/i);
      if (!enc?.[1]) continue;
      const audio = decodeXml(enc[1]);
      if (!/^https?:\/\//i.test(audio)) continue;
      const articleTitle = tagText(item, "podcaster:articleTitle");
      const episodeTitle = tagText(item, "title");
      for (const t of [articleTitle, episodeTitle]) {
        if (t) map.set(`title:${normalizeTitle(t)}`, audio);
      }
    }
    if (map.size > 0) {
      console.log(`[site] audio map from RSS: ${map.size} title keys`);
    }
  } catch (err) {
    console.warn("audio map RSS unavailable", err);
  }
  return map;
}

async function fetchArticleAudioMapFromSupabase(): Promise<Map<string, string>> {
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
      cache: "force-cache",
    });
    if (!res.ok) {
      console.warn("audio map fetch failed", res.status, await res.text().catch(() => ""));
      return map;
    }
    const rows = (await res.json()) as Array<{
      audio_url: string | null;
      articles: ArticleJoin | ArticleJoin[] | null;
    }>;
    const storageBase = `https://${ref}.supabase.co/storage/v1/object/public/podcast`;
    for (const row of rows) {
      if (!row.audio_url) continue;
      const audio = row.audio_url.startsWith("http")
        ? row.audio_url
        : `${storageBase}/${row.audio_url.replace(/^\//, "")}`;
      const article = articleJoin(row);
      const meta = article?.ingest_meta ?? {};
      const keys = [meta.inbox_file, meta.legacyFilename, article?.content_path].filter(
        (k): k is string => Boolean(k),
      );
      for (const k of keys) registerAudioKey(map, k, audio);
    }
    if (map.size > 0) {
      console.log(`[site] audio map from Supabase: ${map.size} keys`);
    }
  } catch (err) {
    console.warn("audio map unavailable", err);
  }
  return map;
}

/**
 * legacyFilename / content_path / title → public audio URL.
 * Server-only. Merges Supabase REST (needs service role) with public RSS fallback.
 */
export async function fetchArticleAudioMap(): Promise<Map<string, string>> {
  const merged = new Map<string, string>();
  const rss = feedUrl();
  if (rss) {
    for (const [k, v] of await fetchArticleAudioMapFromRss(rss)) merged.set(k, v);
  }
  for (const [k, v] of await fetchArticleAudioMapFromSupabase()) merged.set(k, v);
  if (merged.size === 0) {
    console.warn(
      "[site] audio map empty — set SUPABASE_PROJECT_REF (+ SERVICE_ROLE_KEY at build) or ensure public RSS is reachable",
    );
  }
  return merged;
}

export function audioForDoc(
  map: Map<string, string>,
  filename: string,
): string | undefined {
  const base = filename.split("/").pop() ?? filename;
  return map.get(filename) ?? map.get(base);
}

export function audioForPublicDoc(
  map: Map<string, string>,
  doc: Pick<PublicDoc, "filename" | "slug" | "dir" | "title">,
): string | undefined {
  const candidates = [
    doc.filename,
    doc.filename.split("/").pop(),
    doc.slug,
    doc.dir,
    `content/docs/${doc.dir}/index.mdoc`,
    `title:${normalizeTitle(doc.title)}`,
  ];
  for (const k of candidates) {
    if (!k) continue;
    const hit = map.get(k);
    if (hit) return hit;
  }
  return undefined;
}
