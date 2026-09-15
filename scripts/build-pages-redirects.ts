#!/usr/bin/env tsx
/**
 * GitHub Pages is no longer the public site (Phase 4).
 * This writes meta-refresh stubs so
 * https://hskksk.github.io/podcaster/articles/{slug}.html still lands on Next.js.
 *
 * Requires NEXT_PUBLIC_SITE_URL (no trailing slash), e.g. https://podcaster.vercel.app
 */
import fs from "node:fs";
import path from "node:path";
import { parseSlugFromFilename } from "./lib/article-slug.ts";
import { parseFrontmatter, parseTitleFromContent, textify } from "./lib/mdoc.ts";

const DOCS_DIR = path.resolve("content/docs");
const OUT_DIR = path.resolve("dist/web");
const ARTICLES_OUT_DIR = path.join(OUT_DIR, "articles");

function siteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").trim();
  return raw.replace(/\/$/, "");
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function redirectHtml(to: string, title: string): string {
  const safe = escapeHtml(to);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${safe}">
  <link rel="canonical" href="${safe}">
  <title>Moved · ${escapeHtml(title)}</title>
</head>
<body>
  <p>This page has moved to <a href="${safe}">${safe}</a>.</p>
</body>
</html>
`;
}

function loadSlugs(): Array<{ slug: string; title: string }> {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs
    .readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const indexPath = path.join(DOCS_DIR, e.name, "index.mdoc");
      if (!fs.existsSync(indexPath)) return null;
      const raw = fs.readFileSync(indexPath, "utf8");
      const { attrs } = parseFrontmatter(raw);
      const markdown = textify(raw);
      const filename = attrs.legacyFilename || `${e.name}.md`;
      const slug = parseSlugFromFilename(filename);
      const title = attrs.title || parseTitleFromContent(markdown, slug);
      return { slug, title };
    })
    .filter((a): a is { slug: string; title: string } => a !== null);
}

const origin = siteOrigin();
if (!origin) {
  console.error("NEXT_PUBLIC_SITE_URL is unset; not writing Pages redirects.");
  process.exit(0);
}

const slugs = loadSlugs();
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(ARTICLES_OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "index.html"), redirectHtml(origin + "/", "Articles"));
for (const { slug, title } of slugs) {
  const dest = `${origin}/articles/${encodeURIComponent(slug)}`;
  fs.writeFileSync(path.join(ARTICLES_OUT_DIR, `${slug}.html`), redirectHtml(dest, title));
}
console.log(`Wrote ${slugs.length} Pages redirects → ${origin}`);
