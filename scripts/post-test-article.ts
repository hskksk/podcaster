#!/usr/bin/env tsx
import crypto from "node:crypto";

const INGEST_URL =
  process.env.INGEST_URL ?? "http://127.0.0.1:54331/functions/v1/ingest";
const WEBHOOK_SECRET = process.env.INGEST_WEBHOOK_SECRET ?? "";
const MEM_NOTE_ID = process.env.MEM_NOTE_ID;

if (!MEM_NOTE_ID) {
  console.error("Error: MEM_NOTE_ID environment variable is required");
  console.error("Usage: MEM_NOTE_ID=<uuid> pnpm tsx scripts/post-test-article.ts");
  process.exit(1);
}

const article = {
  title: "テスト記事: AI生成ポッドキャストの仕組み",
  mem_note_id: MEM_NOTE_ID,
};

const body = JSON.stringify(article);

// Include service role key as Bearer token for local dev (supabase functions serve enforces JWT)
const authKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
};

if (WEBHOOK_SECRET) {
  const mac = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  headers["x-signature"] = `sha256=${mac}`;
}

console.log(`POST ${INGEST_URL}`);
const res = await fetch(INGEST_URL, { method: "POST", headers, body });
const json = await res.json();
console.log(`Status: ${res.status}`, json);
