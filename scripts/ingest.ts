#!/usr/bin/env tsx
// Usage: pnpm tsx scripts/ingest.ts <mem-note-id>

import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { detectLocalStatus, detectProjectRef, detectServiceKey } from "./lib/supabase-detect.ts";

dotenv.config({ path: ".env" });

const memNoteId = process.argv[2];
if (!memNoteId) {
  console.error("Usage: pnpm tsx scripts/ingest.ts <mem-note-id>");
  process.exit(1);
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
  body: JSON.stringify({ mem_note_id: memNoteId }),
});
const json = await res.json();
console.log(`Status: ${res.status}`, JSON.stringify(json));
if (!res.ok) process.exit(1);
