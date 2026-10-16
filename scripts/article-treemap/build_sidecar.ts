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
import { suggestNodeLabels } from "./suggest_node_labels.ts";

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

const nodes = suggestNodeLabels(manifest.nodes);

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
