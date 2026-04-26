#!/usr/bin/env tsx
// Usage: pnpm cli <command> [options]
//   pnpm cli list episodes [--limit N]
//   pnpm cli list articles [--limit N]
//   pnpm cli list audio    [--limit N]
//   pnpm cli download audio <id>
//   pnpm cli status <article_id>
//   pnpm cli logs [--limit N] [--queue <name>] [--status <status>] [--episode <id>]

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

function flagStr(name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  return undefined;
}

const [cmd, sub, param] = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));

function usage(): never {
  console.error(`Usage:
  pnpm cli list episodes [--limit N]
  pnpm cli list articles [--limit N]
  pnpm cli list audio    [--limit N]
  pnpm cli download audio <id>
  pnpm cli status <article_id>
  pnpm cli logs [--limit N] [--queue <name>] [--status <status>] [--episode <id>]`);
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
  const { data, error } = await db
    .from("audio_files")
    .select("id, episode_id, storage_path, mime_type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { console.error("Error:", error.message); process.exit(1); }

  const rows = (data ?? []).map((r) => [
    shortId(r.id),
    shortId(r.episode_id ?? ""),
    r.storage_path ?? "",
    r.mime_type ?? "",
    r.status ?? "",
    fmtDate(r.created_at),
  ]);
  printTable(["ID", "Episode", "Storage Path", "MIME", "Status", "Created At"], rows);
}

async function downloadAudio(id: string): Promise<void> {
  const { data: row, error: lookupErr } = await db
    .from("audio_files")
    .select("id, episode_id, storage_path, mime_type")
    .or(`id.eq.${id},episode_id.eq.${id}`)
    .maybeSingle();

  if (lookupErr) { console.error("Error:", lookupErr.message); process.exit(1); }

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
    .select("id, title, status, created_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });

  if (epErr) { console.error("Error:", epErr.message); process.exit(1); }

  console.log("\nEpisode");
  console.log("-------");
  if (!episodes || episodes.length === 0) {
    console.log("(no episode yet)");
    return;
  }

  printTable(
    ["ID", "Title", "Status", "Created At"],
    episodes.map((e) => [shortId(e.id), truncate(e.title ?? ""), e.status ?? "", fmtDate(e.created_at)])
  );

  const episodeIds = episodes.map((e) => e.id);

  // Scripts
  const { data: scripts, error: scErr } = await db
    .from("scripts")
    .select("id, episode_id, status, error, created_at")
    .in("episode_id", episodeIds)
    .order("created_at", { ascending: false });

  if (scErr) { console.error("Error:", scErr.message); process.exit(1); }

  console.log("\nScript");
  console.log("------");
  if (!scripts || scripts.length === 0) {
    console.log("(no script yet)");
  } else {
    printTable(
      ["ID", "Episode", "Status", "Created At"],
      scripts.map((s) => [shortId(s.id), shortId(s.episode_id), s.status ?? "", fmtDate(s.created_at)])
    );
    for (const s of scripts) {
      if (s.error) console.log(`  error: ${s.error}`);
    }
  }

  // Audio files
  const { data: audioFiles, error: afErr } = await db
    .from("audio_files")
    .select("id, episode_id, storage_path, mime_type, status, error, created_at")
    .in("episode_id", episodeIds)
    .order("created_at", { ascending: false });

  if (afErr) { console.error("Error:", afErr.message); process.exit(1); }

  console.log("\nAudio");
  console.log("-----");
  if (!audioFiles || audioFiles.length === 0) {
    console.log("(no audio file yet)");
  } else {
    printTable(
      ["ID", "Episode", "Storage Path", "MIME", "Status", "Created At"],
      audioFiles.map((a) => [
        shortId(a.id),
        shortId(a.episode_id),
        a.storage_path ?? "",
        a.mime_type ?? "",
        a.status ?? "",
        fmtDate(a.created_at),
      ])
    );
    for (const a of audioFiles) {
      if (a.error) console.log(`  error: ${a.error}`);
    }
  }
}

async function listLogs(opts: {
  limit: number;
  queue?: string;
  status?: string;
  episodeId?: string;
}): Promise<void> {
  let query = db
    .from("processing_logs")
    .select("processed_at, queue_name, status, episode_id, duration_ms, error_message")
    .order("processed_at", { ascending: false })
    .limit(opts.limit);

  if (opts.queue)     query = query.eq("queue_name", opts.queue);
  if (opts.status)    query = query.eq("status", opts.status);
  if (opts.episodeId) query = query.eq("episode_id", opts.episodeId);

  const { data, error } = await query;
  if (error) { console.error("Error:", error.message); process.exit(1); }

  const rows = (data ?? []).map((r) => [
    fmtDate(r.processed_at),
    r.queue_name ?? "",
    r.status ?? "",
    shortId(r.episode_id ?? ""),
    r.duration_ms != null ? `${r.duration_ms} ms` : "",
    truncate(r.error_message ?? "", 40),
  ]);
  printTable(["Timestamp", "Queue", "Status", "Episode", "Duration", "Error"], rows);
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
} else if (cmd === "logs") {
  await listLogs({
    limit: flag("--limit", 20),
    queue: flagStr("--queue"),
    status: flagStr("--status"),
    episodeId: flagStr("--episode"),
  });
} else {
  usage();
}
