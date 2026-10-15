#!/usr/bin/env tsx
/**
 * Validate treemap.yml next to index.mdoc.
 *
 *   pnpm exec tsx scripts/article-treemap/validate_treemap.ts content/docs/<slug>/index.mdoc
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import yaml from "js-yaml";
import { flattenTreemapNodes, parseTreemapDocument } from "@hskksk/markdoc-react";
import { parseFrontmatter } from "../lib/mdoc.ts";
import { nodeNeedsLabel } from "./shared.ts";

const mdocPath = process.argv[2];
if (!mdocPath) {
  console.error("usage: validate_treemap.ts <path/to/index.mdoc>");
  process.exit(2);
}

const LINK_TYPES = new Set([
  "flow",
  "seq",
  "cause",
  "evidence",
  "apply",
  "contrast",
  "rec",
  "end",
  "ref",
]);

const abs = resolve(mdocPath);
const ymlPath = join(dirname(abs), "treemap.yml");
if (!existsSync(ymlPath)) {
  console.error(`missing ${ymlPath}`);
  process.exit(1);
}

const source = readFileSync(abs, "utf8");
const { attrs, body } = parseFrontmatter(source);
const expectedSha = createHash("sha256").update(body, "utf8").digest("hex");
const doc = parseTreemapDocument(body, { title: attrs.title });
const flat = flattenTreemapNodes(doc);
const knownIds = new Set(flat.map(({ node }) => node.id));

const needsLabel = new Set(flat.filter(nodeNeedsLabel).map(({ node }) => node.id));

type Sidecar = {
  version?: number;
  sourceSha256?: string;
  nodes?: Record<string, { title?: string; subtitle?: string }>;
  links?: Array<{ from?: string; to?: string; type?: string }>;
  chapterFlow?: string[];
};

const sidecar = yaml.load(readFileSync(ymlPath, "utf8")) as Sidecar;
const errors: string[] = [];

if (sidecar.version !== 1) errors.push("version must be 1");
if (sidecar.sourceSha256 !== expectedSha) {
  errors.push(`sourceSha256 mismatch (expected ${expectedSha})`);
}

const labeled = sidecar.nodes ?? {};
for (const id of needsLabel) {
  const entry = labeled[id];
  if (!entry?.title?.trim() && !entry?.subtitle?.trim()) {
    errors.push(`nodes.${id}: needs title or subtitle`);
  }
}

for (const id of Object.keys(labeled)) {
  if (!knownIds.has(id)) {
    errors.push(`nodes.${id}: unknown id (not in current treemap)`);
  }
}

const links = sidecar.links ?? [];
for (let i = 0; i < links.length; i++) {
  const link = links[i];
  const from = link.from?.trim();
  const to = link.to?.trim();
  const type = link.type?.trim();
  if (!from || !to || !type) {
    errors.push(`links[${i}]: from, to, type required`);
    continue;
  }
  if (!LINK_TYPES.has(type)) errors.push(`links[${i}]: invalid type ${type}`);
  if (!knownIds.has(from)) errors.push(`links[${i}]: unknown from id ${from}`);
  if (!knownIds.has(to)) errors.push(`links[${i}]: unknown to id ${to}`);
  if (from === to) errors.push(`links[${i}]: from and to must differ`);
}

if (links.length > 30) {
  errors.push(`links: at most 30 (treemap display limit); got ${links.length}`);
}

const chapterFlow = sidecar.chapterFlow ?? [];
const maxFlow = Math.max(0, doc.chapters.length - 1);
if (chapterFlow.length > maxFlow) {
  errors.push(`chapterFlow: at most ${maxFlow} entries for this document`);
}

if (errors.length) {
  for (const e of errors) console.error(e);
  process.exit(1);
}

console.log(
  `ok: treemap.yml (${Object.keys(labeled).length} nodes, ${links.length} links, ${needsLabel.size} required labels satisfied)`,
);
