#!/usr/bin/env tsx
// Usage:
//   pnpm tsx scripts/ingest.ts --file <path> [--route <route>] [--meta <json>]
//   pnpm tsx scripts/ingest.ts <path-to-existing-file> [--route <route>] [--meta <json>]

import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { detectLocalStatus, detectProjectRef, detectServiceKey } from "./lib/supabase-detect.ts";
import { parseFrontmatter, parseTitleFromContent, textify } from "./lib/mdoc.ts";

dotenv.config({ path: ".env" });

type ParsedArgs = { filePath: string; route?: string; meta?: Record<string, unknown> };

function parseArgs(argv: string[]): ParsedArgs {
  let filePath: string | undefined;
  let route: string | undefined;
  let meta: Record<string, unknown> | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" || a === "-f") {
      filePath = argv[++i];
      if (!filePath) {
        console.error("Missing value for --file");
        process.exit(1);
      }
    } else if (a === "--collection-title") {
      argv[++i];
      console.warn("--collection-title is ignored (mem.ai sync was removed in Phase 6)");
    } else if (a === "--route") {
      route = argv[++i];
      if (!route) {
        console.error("Missing value for --route");
        process.exit(1);
      }
    } else if (a === "--meta") {
      const v = argv[++i];
      if (!v) {
        console.error("Missing value for --meta");
        process.exit(1);
      }
      try {
        meta = JSON.parse(v) as Record<string, unknown>;
      } catch {
        console.error(`--meta must be valid JSON: ${v}`);
        process.exit(1);
      }
    } else if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    } else if (filePath === undefined) {
      filePath = a;
    } else {
      console.error(`Unexpected argument: ${a}`);
      process.exit(1);
    }
  }

  if (!filePath) {
    console.error(`Usage:
  pnpm tsx scripts/ingest.ts --file <path> [--route <route>] [--meta <json>]
  pnpm tsx scripts/ingest.ts <path-to-existing-file> [--route <route>] [--meta <json>]`);
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!existsSync(resolved)) {
    console.error(`File not found: ${filePath}
mem.ai note-id ingest was removed in Phase 6. Pass a Git content path instead.`);
    process.exit(1);
  }

  return { filePath: resolved, route, meta };
}

function extractTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function repoRelative(filePath: string): string {
  const abs = path.resolve(filePath);
  const root = path.resolve(process.cwd());
  if (abs === root || abs.startsWith(root + path.sep)) {
    return path.relative(root, abs).split(path.sep).join("/");
  }
  return filePath.split(path.sep).join("/");
}

const parsed = parseArgs(process.argv.slice(2));

const target = process.env.TARGET ?? "remote";

let authKey: string;
let ingestUrl: string;

if (target === "remote") {
  const projectRef = detectProjectRef();
  authKey = detectServiceKey(projectRef);
  ingestUrl = `https://${projectRef}.supabase.co/functions/v1/ingest`;
} else {
  const { apiUrl, serviceKey } = detectLocalStatus();
  authKey = serviceKey;
  ingestUrl = `${apiUrl}/functions/v1/ingest`;
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
};

const raw = readFileSync(parsed.filePath, "utf-8");
const rel = repoRelative(parsed.filePath);
const isMdoc = rel.endsWith(".mdoc") || raw.startsWith("---");
const content = isMdoc ? textify(raw) : raw;
const { attrs } = parseFrontmatter(raw);
const title =
  attrs.title || parseTitleFromContent(content, extractTitle(content) ?? path.basename(parsed.filePath));

const ingestMeta: Record<string, unknown> = {
  ...(parsed.meta ?? {}),
  ...(attrs.legacyFilename
    ? { inbox_file: attrs.legacyFilename, legacyFilename: attrs.legacyFilename }
    : {}),
};

const postBody: Record<string, unknown> = {
  content,
  title,
  ...(parsed.route !== undefined ? { ingest_route: parsed.route } : {}),
  ingest_meta: ingestMeta,
  ...(rel.startsWith("content/") ? { content_path: rel, content_sha: sha256(raw) } : {}),
  ...(attrs.sourceUrl || attrs.url ? { source_url: attrs.sourceUrl || attrs.url } : {}),
};

console.log(`POST ${ingestUrl}`);
const res = await fetch(ingestUrl, {
  method: "POST",
  headers,
  body: JSON.stringify(postBody),
});
const text = await res.text();
let json: unknown = text;
try {
  json = JSON.parse(text);
} catch {
  // plain-text error bodies (e.g. 409 Duplicate content_path)
}
console.log(`Status: ${res.status}`, typeof json === "string" ? json : JSON.stringify(json));
if (res.status === 409) {
  console.error("content_path already ingested. Use requeue/force to regenerate.");
  process.exit(1);
}
if (!res.ok) process.exit(1);
