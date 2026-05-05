#!/usr/bin/env tsx
// Usage:
//   pnpm tsx scripts/ingest.ts <mem-note-id>
//   pnpm tsx scripts/ingest.ts --file <path> [--collection-title <title>]...
//   pnpm tsx scripts/ingest.ts <path-to-existing-file> [--collection-title <title>]...
//   (file modes default to --collection-title "Podcast Drafts" when none given)

import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { detectLocalStatus, detectProjectRef, detectServiceKey } from "./lib/supabase-detect.ts";
import {
  createMemNoteFromFile,
  DEFAULT_MEM_COLLECTION_TITLE,
} from "./lib/create-mem-note-from-file.js";

dotenv.config({ path: ".env" });

type ParsedArgs =
  | { mode: "id"; memNoteId: string; route?: string; meta?: Record<string, unknown> }
  | { mode: "file"; filePath: string; collectionTitles: string[]; route?: string; meta?: Record<string, unknown> };

function parseArgs(argv: string[]): ParsedArgs {
  const collectionTitles: string[] = [];
  let filePath: string | undefined;
  let memNoteId: string | undefined;
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
      const v = argv[++i];
      if (!v) {
        console.error("Missing value for --collection-title");
        process.exit(1);
      }
      collectionTitles.push(v);
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
    } else if (memNoteId === undefined && filePath === undefined) {
      memNoteId = a;
    } else {
      console.error(`Unexpected argument: ${a}`);
      process.exit(1);
    }
  }

  if (filePath && memNoteId) {
    console.error("Use either --file <path> or <mem-note-id>, not both");
    process.exit(1);
  }

  if (filePath) {
    return { mode: "file", filePath, collectionTitles, route, meta };
  }

  if (memNoteId) {
    const maybeFile = path.resolve(memNoteId);
    if (existsSync(maybeFile)) {
      return { mode: "file", filePath: maybeFile, collectionTitles, route, meta };
    }
    return { mode: "id", memNoteId, route, meta };
  }

  console.error(`Usage:
  pnpm tsx scripts/ingest.ts <mem-note-id> [--route <route>] [--meta <json>]
  pnpm tsx scripts/ingest.ts --file <path> [--collection-title <title>]... [--route <route>] [--meta <json>]
  pnpm tsx scripts/ingest.ts <path-to-existing-file> [--route <route>] [--meta <json>]
  (default collection for file modes: ${DEFAULT_MEM_COLLECTION_TITLE})`);
  process.exit(1);
}

const parsed = parseArgs(process.argv.slice(2));
let memNoteId: string;
if (parsed.mode === "file") {
  console.log(`Registering file in mem.ai: ${parsed.filePath}`);
  try {
    memNoteId = createMemNoteFromFile(parsed.filePath, parsed.collectionTitles);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  console.log(`mem_note_id: ${memNoteId}`);
} else {
  memNoteId = parsed.memNoteId;
}

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

console.log(`POST ${ingestUrl}`);
const res = await fetch(ingestUrl, {
  method: "POST",
  headers,
  body: JSON.stringify({
    mem_note_id: memNoteId,
    ...(parsed.route !== undefined ? { ingest_route: parsed.route } : {}),
    ...(parsed.meta !== undefined ? { ingest_meta: parsed.meta } : {}),
  }),
});
const json = await res.json();
console.log(`Status: ${res.status}`, JSON.stringify(json));
if (!res.ok) process.exit(1);
