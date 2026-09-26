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

/** Preview deploys revalidate; production build keeps force-cache. */
function externalFetchInit(): RequestInit {
  if (process.env.VERCEL_ENV === "preview") {
    return { next: { revalidate: 120 } };
  }
  return { cache: "force-cache" };
}

function decodeXml(s: string): string {
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

function registerImageKey(map: Map<string, string>, key: string, image: string) {
  if (!key) return;
  map.set(key, image);
  const base = key.split("/").pop();
  if (base && base !== key) map.set(base, image);

  const docDir = key.match(/content\/docs\/([^/]+)\/index\.mdoc/);
  if (docDir?.[1]) map.set(docDir[1], image);
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

/** Public RSS itunes:image — no service role required (Vercel Preview build fallback). */
async function fetchArticleImageMapFromRss(rssUrl: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch(rssUrl, externalFetchInit());
    if (!res.ok) {
      console.warn("image map RSS fetch failed", res.status);
      return map;
    }
    const xml = await res.text();
    for (const block of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
      const item = block[1] ?? "";
      const img = item.match(/<itunes:image[^>]+href="([^"]+)"/i);
      if (!img?.[1]) continue;
      const image = decodeXml(img[1]);
      if (!/^https?:\/\//i.test(image)) continue;
      const articleTitle = tagText(item, "podcaster:articleTitle");
      const episodeTitle = tagText(item, "title");
      for (const t of [articleTitle, episodeTitle]) {
        if (t) map.set(`title:${normalizeTitle(t)}`, image);
      }
    }
    if (map.size > 0) {
      console.log(`[site] image map from RSS: ${map.size} title keys`);
    }
  } catch (err) {
    console.warn("image map RSS unavailable", err);
  }
  return map;
}

async function fetchArticleImageMapFromSupabase(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const url = supabaseUrl();
  const key = serviceKey();
  const ref = projectRef();
  if (!url || !key || !ref) return map;

  const endpoint =
    `${url}/rest/v1/episodes?select=image_url,articles(ingest_meta,content_path)` +
    `&image_url=not.is.null`;
  try {
    const res = await fetch(endpoint, {
      ...externalFetchInit(),
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) {
      console.warn("image map fetch failed", res.status, await res.text().catch(() => ""));
      return map;
    }
    const rows = (await res.json()) as Array<{
      image_url: string | null;
      articles: ArticleJoin | ArticleJoin[] | null;
    }>;
    const storageBase = `https://${ref}.supabase.co/storage/v1/object/public/podcast`;
    for (const row of rows) {
      if (!row.image_url) continue;
      const image = row.image_url.startsWith("http")
        ? row.image_url
        : `${storageBase}/${row.image_url.replace(/^\//, "")}`;
      const article = articleJoin(row);
      const meta = article?.ingest_meta ?? {};
      const keys = [meta.inbox_file, meta.legacyFilename, article?.content_path].filter(
        (k): k is string => Boolean(k),
      );
      for (const k of keys) registerImageKey(map, k, image);
    }
    if (map.size > 0) {
      console.log(`[site] image map from Supabase: ${map.size} keys`);
    }
  } catch (err) {
    console.warn("image map unavailable", err);
  }
  return map;
}

/**
 * legacyFilename / content_path / title → public episode artwork URL.
 * Merges Supabase REST (needs service role) with public RSS fallback.
 */
export async function fetchArticleImageMap(): Promise<Map<string, string>> {
  const merged = new Map<string, string>();
  const rss = feedUrl();
  if (rss) {
    for (const [k, v] of await fetchArticleImageMapFromRss(rss)) merged.set(k, v);
  }
  for (const [k, v] of await fetchArticleImageMapFromSupabase()) merged.set(k, v);
  if (merged.size === 0) {
    console.warn(
      "[site] image map empty — set SUPABASE_PROJECT_REF (+ SERVICE_ROLE_KEY at build) or ensure public RSS has itunes:image",
    );
  }
  return merged;
}

export function imageForDoc(
  map: Map<string, string>,
  filename: string,
): string | undefined {
  const base = filename.split("/").pop() ?? filename;
  return map.get(filename) ?? map.get(base);
}

export function imageForPublicDoc(
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
