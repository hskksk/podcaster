#!/usr/bin/env tsx
/**
 * DEV ONLY — overwrites nodes with heuristics. Never use for wiki articles.
 *
 *   pnpm exec tsx scripts/article-treemap/_dev/refresh_sidecar_nodes.ts content/docs/<slug>/index.mdoc
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import yaml from "js-yaml";
import { suggestNodeLabels } from "./suggest_node_labels.ts";

const mdocPath = resolve(process.argv[2] ?? "");
if (!mdocPath) {
  console.error("usage: refresh_sidecar_nodes.ts <path/to/index.mdoc>");
  process.exit(2);
}

const ymlPath = join(dirname(mdocPath), "treemap.yml");
if (!existsSync(ymlPath)) {
  console.error(`missing ${ymlPath}`);
  process.exit(1);
}

const json = execSync(`pnpm exec tsx scripts/article-treemap/extract_nodes.ts "${mdocPath}"`, {
  encoding: "utf8",
  cwd: resolve(import.meta.dirname, "../../.."),
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

const sidecar = yaml.load(readFileSync(ymlPath, "utf8")) as Record<string, unknown>;
const suggested = suggestNodeLabels(manifest.nodes);

sidecar.version = 1;
sidecar.sourceSha256 = manifest.sourceSha256;
sidecar.nodes = suggested;

writeFileSync(ymlPath, yaml.dump(sidecar, { lineWidth: 120, noRefs: true }), "utf8");
console.log(
  `refreshed ${ymlPath} (${Object.keys(suggested).length} nodes; links preserved)`,
);
