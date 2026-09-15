import "server-only";

import fs from "node:fs";
import path from "node:path";
import { getSiteDataRoot } from "../repo-root";

export type SiteConfig = {
  siteTitle: string;
  siteDescription: string;
  siteUrl: string;
  coverImage: string;
};

function unquote(value: string): string {
  const t = value.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

export function loadSiteConfig(): SiteConfig {
  const fallback: SiteConfig = {
    siteTitle: "Podcaster Articles",
    siteDescription: "",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "",
    coverImage: "cover.png",
  };
  const tomlPath = path.join(getSiteDataRoot(), "config.toml");
  if (!fs.existsSync(tomlPath)) return fallback;
  const raw = fs.readFileSync(tomlPath, "utf8");
  const podcast: Record<string, string> = {};
  let inPodcast = false;
  for (const line of raw.split(/\r?\n/)) {
    if (/^\[podcast\]/.test(line)) {
      inPodcast = true;
      continue;
    }
    if (/^\s*\[/.test(line)) {
      inPodcast = false;
      continue;
    }
    if (!inPodcast) continue;
    const kv = line.match(/^([A-Za-z_]+)\s*=\s*(.*)$/);
    if (!kv) continue;
    podcast[kv[1]] = unquote(kv[2]);
  }
  return {
    siteTitle: podcast.title || fallback.siteTitle,
    siteDescription: podcast.description || fallback.siteDescription,
    siteUrl: podcast.site_url || fallback.siteUrl,
    coverImage: podcast.cover_image || fallback.coverImage,
  };
}

export function projectRef(): string {
  return (process.env.SUPABASE_PROJECT_REF || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF || "").trim();
}

export function feedUrl(): string {
  const ref = projectRef();
  return ref ? `https://${ref}.supabase.co/storage/v1/object/public/podcast/feed.xml` : "";
}
