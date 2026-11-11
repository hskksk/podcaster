#!/usr/bin/env tsx
/**
 * Emit section manifest JSON for article-section-visuals authoring.
 *
 *   pnpm section-visuals:extract content/docs/<slug>/index.mdoc
 *
 * Heading `id` values match {@link extractMinimapOutline} (same rules as the public site).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractMinimapOutline } from "@hskksk/markdoc-react/server";
import { parseFrontmatter } from "../lib/mdoc.ts";

function scanHeadingLines(body: string): { startLine: number; level: number; title: string }[] {
  const lines = body.split(/\n/);
  const headings: { startLine: number; level: number; title: string }[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(`{3,}|~{3,})/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    headings.push({
      startLine: i + 1,
      level: m[1].length,
      title: m[2].trim(),
    });
  }
  return headings;
}

const mdocPath = process.argv[2];
if (!mdocPath) {
  console.error("usage: extract_sections.ts <path/to/index.mdoc>");
  process.exit(2);
}

const abs = resolve(mdocPath);
const source = readFileSync(abs, "utf8");
const { attrs, body } = parseFrontmatter(source);
const sourceSha256 = createHash("sha256").update(body, "utf8").digest("hex");
const outline = extractMinimapOutline(body);
const headingLines = scanHeadingLines(body);

if (headingLines.length !== outline.sections.length) {
  console.error(
    `heading line count (${headingLines.length}) !== outline sections (${outline.sections.length}); cannot assign line ranges`,
  );
  process.exit(1);
}

const sections = outline.sections.map((section, index) => {
  const { startLine, level, title } = headingLines[index];
  const nextStart = headingLines[index + 1]?.startLine;
  const endLine = nextStart ? nextStart - 1 : body.split(/\n/).length;
  const slice = body
    .split(/\n/)
    .slice(startLine - 1, endLine)
    .join("\n")
    .trim();

  if (section.id !== outline.sections[index].id) {
    throw new Error("internal: outline order mismatch");
  }
  if (section.level !== level || section.title !== title) {
    console.warn(
      `warning: heading line "${title}" (L${level}) paired with outline "${section.title}" (L${section.level})`,
    );
  }

  return {
    id: section.id,
    level: section.level,
    title: section.title,
    startLine,
    endLine,
    body: slice,
  };
});

const payload = {
  mdocPath: abs,
  docTitle: attrs.title ?? "",
  sourceSha256,
  sectionCount: sections.length,
  sections,
};

console.log(JSON.stringify(payload, null, 2));
