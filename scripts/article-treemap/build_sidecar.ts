#!/usr/bin/env tsx
/**
 * Mechanical backfill for treemap.yml (titles + non-opening subtitles).
 * New articles should use the `article-treemap-labels` skill for real summaries.
 *
 *   pnpm exec tsx scripts/article-treemap/build_sidecar.ts content/docs/<slug>/index.mdoc
 */
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import yaml from "js-yaml";
import { execSync } from "node:child_process";
import { suggestLinksFromManifest } from "./suggest_links.ts";

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
  orderedNodeIds: string[];
  chapters: Array<{ id: string; title: string }>;
  explicitLinks?: Array<{ from: string; to: string; type?: string }>;
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

function parentPath(path: string): string | undefined {
  const parts = path.split(" > ");
  if (parts.length < 2) return undefined;
  return parts[parts.length - 2];
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function looksLikeOpeningSnippet(title: string, excerpt: string): boolean {
  const t = title.replace(/\s+/g, "").replace(/…$/g, "");
  const e = excerpt.replace(/\s+/g, "");
  if (!t || t.length < 8) return false;
  return e.startsWith(t) || title.endsWith("…");
}

function suggestTitle(node: {
  id: string;
  path: string;
  title: string;
  excerpt: string;
}): string {
  const leaf = leafPath(node.path);
  const parent = parentPath(node.path);

  if (/^\[\d+\]/.test(node.excerpt.trim())) {
    const cite = node.excerpt.trim().match(/^\[(\d+)\]\s*([^.”]+)/);
    if (cite) return clip(`[${cite[1]}] ${cite[2]}`, 22);
  }

  if (node.excerpt.startsWith("[表]") || node.excerpt.startsWith("[コード")) {
    return clip(leaf, 22);
  }

  if (looksLikeOpeningSnippet(node.title, node.excerpt) && parent) {
    return clip(parent, 22);
  }

  if (leaf.length <= 22 && !leaf.endsWith("…")) return leaf;
  if (parent && parent.length <= 22) return parent;

  const sents = sentences(node.excerpt);
  if (sents.length >= 2) return clip(sents[1], 20);

  return clip(leaf, 20);
}

/** Prefer 2nd+ sentences so the tile is not a duplicate of the auto first-line title. */
function suggestSubtitle(node: { path: string; title: string; excerpt: string }): string {
  if (/^\[\d+\]/.test(node.excerpt.trim())) {
    return clip(node.excerpt.replace(/\s+/g, " ").trim(), 78);
  }

  const sents = sentences(node.excerpt);
  if (sents.length >= 2) {
    return clip(sents.slice(1, 3).join(""), 78);
  }

  const parent = parentPath(node.path);
  if (parent && looksLikeOpeningSnippet(node.title, node.excerpt)) {
    return clip(`${parent}：${sents[0] ?? node.excerpt}`, 78);
  }

  return clip(sents[0] ?? node.excerpt, 78);
}

const nodes: Record<string, { title?: string; subtitle?: string }> = {};

for (const node of manifest.nodes) {
  if (!node.needsLabel) continue;
  const title = suggestTitle(node);
  const subtitle = suggestSubtitle(node);
  nodes[node.id] = {
    title: title.trim(),
    subtitle: subtitle.trim(),
  };
}

const { links, chapterFlow } = suggestLinksFromManifest(manifest);

const sidecar = {
  version: 1,
  sourceSha256: manifest.sourceSha256,
  nodes,
  links,
  chapterFlow,
};

const outPath = join(dirname(mdocPath), "treemap.yml");
writeFileSync(outPath, yaml.dump(sidecar, { lineWidth: 120, noRefs: true }), "utf8");
console.log(
  `wrote ${outPath} (${Object.keys(nodes).length} nodes, ${links.length} links)`,
);
