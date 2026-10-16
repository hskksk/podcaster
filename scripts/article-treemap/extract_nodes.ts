#!/usr/bin/env tsx
/**
 * Emit treemap node manifest for LLM label generation.
 *
 *   pnpm exec tsx scripts/article-treemap/extract_nodes.ts content/docs/<slug>/index.mdoc
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  flattenTreemapNodes,
  parseTreemapDocument,
} from "@hskksk/markdoc-react";
import { parseFrontmatter } from "../lib/mdoc.ts";
import { TREEMAP_LINK_TYPE_GUIDE } from "./link-types.ts";
import { nodeNeedsLabel } from "./shared.ts";

const mdocPath = process.argv[2];
if (!mdocPath) {
  console.error("usage: extract_nodes.ts <path/to/index.mdoc>");
  process.exit(2);
}

const abs = resolve(mdocPath);
const source = readFileSync(abs, "utf8");
const { attrs, body } = parseFrontmatter(source);
const sourceSha256 = createHash("sha256").update(body, "utf8").digest("hex");
const doc = parseTreemapDocument(body, { title: attrs.title });
const flat = flattenTreemapNodes(doc);

const nodes = flat.map((entry) => {
  const { node, path } = entry;
  const title = node.title ?? "";
  return {
    id: node.id,
    kind: node.kind,
    path: path.join(" > "),
    title,
    subtitle: node.subtitle ?? null,
    needsLabel: nodeNeedsLabel(entry),
    excerpt: (node.text || title).slice(0, 500),
  };
});

const payload = {
  mdocPath: abs,
  docTitle: doc.title ?? attrs.title ?? "",
  sourceSha256,
  nodeCount: nodes.length,
  needsLabelCount: nodes.filter((n) => n.needsLabel).length,
  orderedNodeIds: flat.map(({ node }) => node.id),
  chapters: doc.chapters.map((ch) => ({ id: ch.id, title: ch.title })),
  explicitLinks: doc.explicitLinks ?? [],
  linkTypes: TREEMAP_LINK_TYPE_GUIDE,
  nodes,
};

console.log(JSON.stringify(payload, null, 2));
