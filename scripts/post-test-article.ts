#!/usr/bin/env tsx

import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { detectProjectRef, detectServiceKey } from "./lib/supabase-detect.ts";

dotenv.config({ path: ".env" });
console.log("Using env file: .env");

const MEM_NOTE_ID = process.env.MEM_NOTE_ID;

if (!MEM_NOTE_ID) {
  console.error("Error: MEM_NOTE_ID environment variable is required");
  console.error("Usage: MEM_NOTE_ID=<uuid> pnpm tsx scripts/post-test-article.ts");
  process.exit(1);
}

const target = process.env.TARGET ?? "local";

let authKey: string;
let ingestUrl: string;

if (target === "remote") {
  dotenv.config({ path: ".env" });
  const projectRef = detectProjectRef();
  authKey = detectServiceKey(projectRef);
  ingestUrl = `https://${projectRef}.supabase.co/functions/v1/ingest`;
} else {
  function getSupabaseStatus(): Record<string, string> {
    try {
      return JSON.parse(
        execSync("supabase status --json", {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        }),
      );
    } catch {
      return {};
    }
  }

  const status = getSupabaseStatus();
  authKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY
    ?? status["SERVICE_ROLE_KEY"] ?? status["ANON_KEY"] ?? "";
  ingestUrl = status["API_URL"]
    ? `${status["API_URL"]}/functions/v1/ingest`
    : "http://127.0.0.1:54331/functions/v1/ingest";
}

const article = {
  title: "テスト記事: AI生成ポッドキャストの仕組み",
  mem_note_id: MEM_NOTE_ID,
  ingest_route: "test",
  ingest_meta: { target },
};

const body = JSON.stringify(article);

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
};

console.log(`POST ${ingestUrl}`);
const res = await fetch(ingestUrl, { method: "POST", headers, body });
const raw = await res.text();
let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch {
  parsed = raw;
}
console.log(`Status: ${res.status}`, parsed);
if (!res.ok) {
  process.exit(1);
}
