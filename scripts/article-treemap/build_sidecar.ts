#!/usr/bin/env tsx
/**
 * Build treemap.yml from index.mdoc using manifest heuristics (for backfill / CI-free batch).
 * Human-authored labels in article-treemap-labels skill are preferred for new articles.
 *
 *   pnpm exec tsx scripts/article-treemap/build_sidecar.ts content/docs/<slug>/index.mdoc
 */
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import yaml from "js-yaml";
import { execSync } from "node:child_process";

const mdocPath = resolve(process.argv[2] ?? "");
if (!mdocPath) {
  console.error("usage: build_sidecar.ts <path/to/index.mdoc>");
  process.exit(2);
}

const json = execSync(`pnpm exec tsx scripts/article-treemap/extract_nodes.ts "${mdocPath}"`, {
  encoding: "utf8",
  cwd: resolve(import.meta.dirname, "../.."),
});
const manifest = JSON.parse(json) as {
  sourceSha256: string;
  nodes: Array<{
    id: string;
    path: string;
    title: string;
    excerpt: string;
    needsLabel: boolean;
  }>;
};

function leafPath(path: string): string {
  const parts = path.split(" > ");
  return parts[parts.length - 1] ?? path;
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function firstSentence(text: string): string {
  const m = text.replace(/\s+/g, " ").match(/^(.+?[。！？])(?:\s|$)/);
  if (m) return m[1].trim();
  const line = text.split(/\n/)[0]?.trim() ?? text;
  return clip(line, 80);
}

function suggestTitle(node: {
  path: string;
  title: string;
  excerpt: string;
}): string {
  const leaf = leafPath(node.path);
  if (/^\[\d+\]/.test(node.excerpt.trim())) {
    const cite = node.excerpt.trim().match(/^\[(\d+)\]\s*([^.”]+)/);
    if (cite) return clip(`[${cite[1]}] ${cite[2]}`, 22);
  }
  if (leaf.length <= 22 && !leaf.endsWith("…")) return leaf;
  if (leaf.length <= 28) return clip(leaf, 22);
  return clip(firstSentence(node.excerpt), 20);
}

function suggestSubtitle(node: { excerpt: string; path: string }): string {
  if (/^\[\d+\]/.test(node.excerpt.trim())) {
    return clip(node.excerpt.replace(/\s+/g, " ").trim(), 78);
  }
  const sent = firstSentence(node.excerpt);
  return clip(sent.length >= 24 ? sent : node.excerpt.replace(/\s+/g, " "), 78);
}

const nodes: Record<string, { title?: string; subtitle?: string }> = {};

for (const node of manifest.nodes) {
  if (!node.needsLabel) continue;
  const title = suggestTitle(node);
  const subtitle = suggestSubtitle(node);
  const entry: { title?: string; subtitle?: string } = {};
  if (title && title !== node.title.slice(0, title.length)) entry.title = title;
  else if (title) entry.title = title;
  if (subtitle && subtitle !== entry.title) entry.subtitle = subtitle;
  if (!entry.title?.trim() && !entry.subtitle?.trim()) {
    entry.subtitle = clip(node.excerpt, 78);
  }
  nodes[node.id] = entry;
}

const sidecar = {
  version: 1,
  sourceSha256: manifest.sourceSha256,
  nodes,
};

const outPath = join(dirname(mdocPath), "treemap.yml");
writeFileSync(outPath, yaml.dump(sidecar, { lineWidth: 120, noRefs: true }), "utf8");
console.log(`wrote ${outPath} (${Object.keys(nodes).length} nodes)`);
