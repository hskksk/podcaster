#!/usr/bin/env tsx
/**
 * DEV ONLY — mechanical link stub. Not for production sidecars.
 *
 *   pnpm exec tsx scripts/article-treemap/_dev/patch_sidecar_links.ts content/docs/<slug>/index.mdoc
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import yaml from "js-yaml";
import { suggestLinksFromManifest } from "./suggest_links.ts";

const mdocPath = resolve(process.argv[2] ?? "");
if (!mdocPath) {
  console.error("usage: patch_sidecar_links.ts <path/to/index.mdoc>");
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
  orderedNodeIds: string[];
  chapters: Array<{ id: string; title: string }>;
  explicitLinks?: Array<{ from: string; to: string; type?: string }>;
};

const sidecar = yaml.load(readFileSync(ymlPath, "utf8")) as Record<string, unknown>;
const { links, chapterFlow } = suggestLinksFromManifest(manifest);

sidecar.version = 1;
sidecar.sourceSha256 = manifest.sourceSha256;
sidecar.links = links;
sidecar.chapterFlow = chapterFlow;

writeFileSync(ymlPath, yaml.dump(sidecar, { lineWidth: 120, noRefs: true }), "utf8");
console.log(`patched ${ymlPath} (${links.length} links, ${chapterFlow.length} chapterFlow)`);
