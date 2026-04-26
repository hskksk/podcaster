#!/usr/bin/env tsx
// Usage: pnpm cli <command> [options]
//   pnpm cli list episodes [--limit N]
//   pnpm cli list articles [--limit N]
//   pnpm cli list audio    [--limit N]
//   pnpm cli download audio <id>
//   pnpm cli status <article_id>

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  detectLocalStatus,
  detectProjectRef,
  detectServiceKey,
} from "./lib/supabase-detect.ts";
import { printTable, shortId, truncate, fmtDate } from "./lib/table.ts";

dotenv.config({ path: ".env" });

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function flag(name: string, defaultVal: number): number {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1]) return parseInt(args[i + 1], 10) || defaultVal;
  return defaultVal;
}

const [cmd, sub, param] = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));

function usage(): never {
  console.error(`Usage:
  pnpm cli list episodes [--limit N]
  pnpm cli list articles [--limit N]
  pnpm cli list audio    [--limit N]
  pnpm cli download audio <id>
  pnpm cli status <article_id>`);
  process.exit(1);
}

if (!cmd) usage();

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const target = process.env.TARGET ?? "remote";
let supabaseUrl: string;
let serviceKey: string;

if (target === "local") {
  const s = detectLocalStatus();
  supabaseUrl = s.apiUrl;
  serviceKey = s.serviceKey;
} else {
  const ref = detectProjectRef();
  serviceKey = detectServiceKey(ref);
  supabaseUrl = `https://${ref}.supabase.co`;
}

const db = createClient(supabaseUrl, serviceKey);

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function listEpisodes(limit: number): Promise<void> {
  const { data, error } = await db
    .from("episodes")
    .select("id, title, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { console.error("Error:", error.message); process.exit(1); }

  const rows = (data ?? []).map((r) => [
    shortId(r.id),
    truncate(r.title ?? ""),
    r.status ?? "",
    fmtDate(r.created_at),
  ]);
  printTable(["ID", "Title", "Status", "Created At"], rows);
}

async function listArticles(limit: number): Promise<void> {
  const { data, error } = await db
    .from("articles")
    .select("id, title, source, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { console.error("Error:", error.message); process.exit(1); }

  const rows = (data ?? []).map((r) => [
    shortId(r.id),
    truncate(r.title ?? ""),
    r.source ?? "",
    fmtDate(r.created_at),
  ]);
  printTable(["ID", "Title", "Source", "Created At"], rows);
}

async function listAudio(limit: number): Promise<void> {
  // Requires audio_files table (scripts/audio_files table split migration)
  const { data, error } = await db
    .from("audio_files")
    .select("id, episode_id, storage_path, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01") {
      console.log(
        "audio_files table not yet available — depends on the scripts/audio_files table split migration."
      );
      return;
    }
    console.error("Error:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []).map((r) => [
    shortId(r.id),
    shortId(r.episode_id ?? ""),
    r.storage_path ?? "",
    r.status ?? "",
    fmtDate(r.created_at),
  ]);
  printTable(["ID", "Episode", "Storage Path", "Status", "Created At"], rows);
}

async function downloadAudio(id: string): Promise<void> {
  // Requires audio_files table (scripts/audio_files table split migration)
  const { data: row, error: lookupErr } = await db
    .from("audio_files")
    .select("id, episode_id, storage_path")
    .or(`id.eq.${id},episode_id.eq.${id}`)
    .maybeSingle();

  if (lookupErr) {
    if (lookupErr.code === "42P01") {
      console.log(
        "audio_files table not yet available — depends on the scripts/audio_files table split migration."
      );
      return;
    }
    console.error("Error:", lookupErr.message);
    process.exit(1);
  }

  if (!row) {
    console.error(`No audio file found for id: ${id}`);
    process.exit(1);
  }

  const storagePath: string = row.storage_path;
  const filename = storagePath.split("/").pop() ?? `${row.id}.audio`;

  console.log(`Downloading ${storagePath} from bucket 'podcast'…`);
  const { data: blob, error: dlErr } = await db.storage
    .from("podcast")
    .download(storagePath);

  if (dlErr || !blob) {
    console.error("Download failed:", dlErr?.message);
    process.exit(1);
  }

  await mkdir("downloads", { recursive: true });
  const dest = join("downloads", filename);
  await writeFile(dest, Buffer.from(await blob.arrayBuffer()));
  console.log(`Saved to ${dest}`);
}

async function pipelineStatus(articleId: string): Promise<void> {
  // Article
  const { data: article, error: artErr } = await db
    .from("articles")
    .select("id, title, source, created_at")
    .eq("id", articleId)
    .maybeSingle();

  if (artErr) { console.error("Error:", artErr.message); process.exit(1); }
  if (!article) { console.error(`Article not found: ${articleId}`); process.exit(1); }

  console.log("\nArticle");
  console.log("-------");
  printTable(
    ["ID", "Title", "Source", "Created At"],
    [[shortId(article.id), truncate(article.title ?? ""), article.source ?? "", fmtDate(article.created_at)]]
  );

  // Episode
  const { data: episodes, error: epErr } = await db
    .from("episodes")
    .select("id, title, status, error, created_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });

  if (epErr) { console.error("Error:", epErr.message); process.exit(1); }

  console.log("\nEpisode");
  console.log("-------");
  if (!episodes || episodes.length === 0) {
    console.log("(no episode yet)");
  } else {
    printTable(
      ["ID", "Title", "Status", "Created At"],
      episodes.map((e) => [shortId(e.id), truncate(e.title ?? ""), e.status ?? "", fmtDate(e.created_at)])
    );
    for (const e of episodes) {
      if (e.error) console.log(`  error: ${e.error}`);
    }
  }

  // Script — future (depends on scripts table split)
  console.log("\nScript");
  console.log("------");
  console.log("(not yet tracked — depends on scripts table split migration)");

  // Audio — future (depends on audio_files table split)
  console.log("\nAudio");
  console.log("-----");
  console.log("(not yet tracked — depends on audio_files table split migration)");
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const limit = flag("--limit", 10);

if (cmd === "list") {
  if (sub === "episodes") await listEpisodes(limit);
  else if (sub === "articles") await listArticles(limit);
  else if (sub === "audio") await listAudio(limit);
  else usage();
} else if (cmd === "download") {
  if (sub === "audio") {
    if (!param) { console.error("Usage: pnpm cli download audio <id>"); process.exit(1); }
    await downloadAudio(param);
  } else {
    usage();
  }
} else if (cmd === "status") {
  if (!sub) { console.error("Usage: pnpm cli status <article_id>"); process.exit(1); }
  await pipelineStatus(sub);
} else {
  usage();
}
