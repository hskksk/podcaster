#!/usr/bin/env tsx
// Usage: pnpm cli <command> [options]
//   pnpm cli list episodes [--limit N]
//   pnpm cli list articles [--limit N]
//   pnpm cli list audio    [--limit N]
//   pnpm cli download audio <id>
//   pnpm cli status <article_id>
//   pnpm cli logs [--limit N] [--queue <name>] [--status <status>] [--episode <id>]
//   pnpm cli requeue script            <episode_id> [--yes]
//   pnpm cli requeue audio             <episode_id> [--yes]
//   pnpm cli requeue rss               <episode_id> [--yes]
//   pnpm cli requeue regenerate-script <episode_id> [--yes]
//   pnpm cli requeue regenerate-audio  <episode_id> [--yes]
//   pnpm cli generate-script --content "<article>" [--with-thoughts] [--verbose]
//   pnpm cli generate-script --file <path> [--with-thoughts] [--verbose]

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { parse as parseToml } from "smol-toml";
import {
  detectLocalStatus,
  detectProjectRef,
  detectServiceKey,
} from "./lib/supabase-detect.ts";
import { printTable, printLong, shortId, truncate, fmtDate } from "./lib/table.ts";
import {
  DEFAULT_SYSTEM_INSTRUCTION,
  DEFAULT_USER_PROMPT_TEMPLATE,
  generateScriptFromArticle,
} from "../shared/script-generation.ts";

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
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("-")) return args[i + 1];
  return undefined;
}

function flagBool(name: string): boolean {
  return args.includes(name);
}

const [cmd, sub, param] = args.filter((a) => !a.startsWith("-") && !/^\d+$/.test(a));

function usage(): never {
  console.error(`Usage:
  pnpm cli list episodes [--limit N] [-o|--output short|wide|long|json]
  pnpm cli list articles [--limit N] [-o|--output short|wide|long|json]
  pnpm cli list audio    [--limit N] [-o|--output short|wide|long|json]
  pnpm cli download audio <id>
  pnpm cli status <article_id>
  pnpm cli logs [--limit N] [--queue <name>] [--status <status>] [--episode <id>]
  pnpm cli requeue script            <episode_id> [--yes]
  pnpm cli requeue audio             <episode_id> [--yes]
  pnpm cli requeue rss               <episode_id> [--yes]
  pnpm cli requeue regenerate-script <episode_id> [--yes]
  pnpm cli requeue regenerate-audio  <episode_id> [--yes]
  pnpm cli generate-script --content "<article>" [--with-thoughts] [--verbose]
  pnpm cli generate-script --file <path> [--with-thoughts] [--verbose]`);
  process.exit(1);
}

if (!cmd) usage();

type LocalGeneratorTomlConfig = {
  generator?: {
    model?: unknown;
    system_instruction?: unknown;
    prompt_template?: unknown;
  };
};

function readGeneratorConfigFromToml(): {
  model: string;
  systemInstruction: string;
  promptTemplate: string;
} {
  const configPath = resolve("config.toml");
  if (!existsSync(configPath)) {
    throw new Error("config.toml not found.");
  }
  const raw = parseToml(readFileSync(configPath, "utf8")) as LocalGeneratorTomlConfig;
  const section = raw.generator ?? {};

  const model = typeof section.model === "string" && section.model.trim()
    ? section.model
    : "gemini-2.5-flash";
  const systemInstruction = typeof section.system_instruction === "string" && section.system_instruction.trim()
    ? section.system_instruction
    : DEFAULT_SYSTEM_INSTRUCTION;
  const promptTemplate = typeof section.prompt_template === "string" && section.prompt_template.trim()
    ? section.prompt_template
    : DEFAULT_USER_PROMPT_TEMPLATE;

  return { model, systemInstruction, promptTemplate };
}

async function generateScriptCli(
  content: string,
  includeThoughts: boolean,
  verbose: boolean,
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is required");
    process.exit(1);
  }
  const generatorConfig = readGeneratorConfigFromToml();
  const prompt = generatorConfig.promptTemplate.replace("{content}", content);

  if (verbose) {
    console.error("[generate-script] system_instruction:");
    console.error(generatorConfig.systemInstruction);
    console.error("[generate-script] prompt:");
    console.error(prompt);
  }

  const gemini = new GoogleGenAI({ apiKey });
  const generated = await generateScriptFromArticle({
    articleContent: content,
    model: generatorConfig.model,
    systemInstruction: generatorConfig.systemInstruction,
    promptTemplate: generatorConfig.promptTemplate,
    thinkingLevel: ThinkingLevel.HIGH,
    includeThoughts,
    generateContent: (params) => gemini.models.generateContent(params),
  });

  const output: Record<string, unknown> = {
    title: generated.title,
    description: generated.description,
    script: generated.script,
    token_usage: generated.tokenUsage,
  };
  if (includeThoughts) {
    output.thoughts = generated.thoughts;
  }
  console.log(JSON.stringify(output, null, 2));
}

if (cmd === "generate-script") {
  const content = flagStr("--content");
  const filePath = flagStr("--file");
  const includeThoughts = flagBool("--with-thoughts");
  const verbose = flagBool("--verbose");

  if (!content && !filePath) {
    console.error("Usage: pnpm cli generate-script --content \"<article>\" [--with-thoughts] [--verbose]");
    console.error("   or: pnpm cli generate-script --file <path> [--with-thoughts] [--verbose]");
    process.exit(1);
  }

  if (content && filePath) {
    console.error("Specify either --content or --file, not both.");
    process.exit(1);
  }

  const articleContent = filePath
    ? await readFile(filePath, "utf-8")
    : content ?? "";

  if (!articleContent.trim()) {
    console.error("Article content is empty.");
    process.exit(1);
  }

  try {
    await generateScriptCli(articleContent, includeThoughts, verbose);
  } catch (error) {
    console.error("Failed to generate script:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  process.exit(0);
}

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

type OutputFormat = "long" | "short" | "wide" | "json";

async function listEpisodes(limit: number, fmt: OutputFormat): Promise<void> {
  const { data, error } = await db
    .from("episodes")
    .select("id, article_id, mem_note_id, title, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { console.error("Error:", error.message); process.exit(1); }
  const rows = data ?? [];

  if (fmt === "short") {
    printTable(["ID", "Title", "Status", "Created At"], rows.map((r) => [
      shortId(r.id), truncate(r.title ?? ""), r.status ?? "", fmtDate(r.created_at),
    ]));
  } else if (fmt === "wide") {
    printTable(["ID", "Article ID", "Mem Note ID", "Title", "Status", "Created At"], rows.map((r) => [
      r.id, r.article_id ?? "", r.mem_note_id ?? "", r.title ?? "", r.status ?? "", fmtDate(r.created_at),
    ]));
  } else if (fmt === "long") {
    printLong(rows.map((r) => ({
      "ID": r.id,
      "Article ID": r.article_id ?? "",
      "Mem Note ID": r.mem_note_id ?? "",
      "Title": r.title ?? "",
      "Status": r.status ?? "",
      "Created At": fmtDate(r.created_at),
    })));
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
}

async function listArticles(limit: number, fmt: OutputFormat): Promise<void> {
  const { data, error } = await db
    .from("articles")
    .select("id, mem_note_id, title, source, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { console.error("Error:", error.message); process.exit(1); }
  const rows = data ?? [];

  if (fmt === "short") {
    printTable(["ID", "Title", "Source", "Created At"], rows.map((r) => [
      shortId(r.id), truncate(r.title ?? ""), r.source ?? "", fmtDate(r.created_at),
    ]));
  } else if (fmt === "wide") {
    printTable(["ID", "Mem Note ID", "Title", "Source", "Created At"], rows.map((r) => [
      r.id, r.mem_note_id ?? "", r.title ?? "", r.source ?? "", fmtDate(r.created_at),
    ]));
  } else if (fmt === "long") {
    printLong(rows.map((r) => ({
      "ID": r.id,
      "Mem Note ID": r.mem_note_id ?? "",
      "Title": r.title ?? "",
      "Source": r.source ?? "",
      "Created At": fmtDate(r.created_at),
    })));
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
}

async function listAudio(limit: number, fmt: OutputFormat): Promise<void> {
  const { data, error } = await db
    .from("audio_files")
    .select("id, episode_id, storage_path, mime_type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { console.error("Error:", error.message); process.exit(1); }
  const rows = data ?? [];

  if (fmt === "short") {
    printTable(["ID", "Episode", "Storage Path", "MIME", "Status", "Created At"], rows.map((r) => [
      shortId(r.id), shortId(r.episode_id ?? ""), r.storage_path ?? "", r.mime_type ?? "", r.status ?? "", fmtDate(r.created_at),
    ]));
  } else if (fmt === "wide") {
    printTable(["ID", "Episode ID", "Storage Path", "MIME", "Status", "Created At"], rows.map((r) => [
      r.id, r.episode_id ?? "", r.storage_path ?? "", r.mime_type ?? "", r.status ?? "", fmtDate(r.created_at),
    ]));
  } else if (fmt === "long") {
    printLong(rows.map((r) => ({
      "ID": r.id,
      "Episode ID": r.episode_id ?? "",
      "Storage Path": r.storage_path ?? "",
      "MIME": r.mime_type ?? "",
      "Status": r.status ?? "",
      "Created At": fmtDate(r.created_at),
    })));
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
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

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

async function startFlowRecord(
  flowSlug: "craftEpisodeSubmit" | "craftEpisodeDownload",
  input: Record<string, unknown>,
  label: string,
  yes: boolean,
): Promise<void> {
  if (!yes) {
    const ok = await confirm(`Start flow ${JSON.stringify(input)} → ${label}?`);
    if (!ok) { console.log("Aborted."); process.exit(0); }
  }
  const { error } = await db.schema("pgflow").rpc("start_flow", {
    flow_slug: flowSlug,
    input,
  });
  if (error) { console.error("Error:", error.message); process.exit(1); }
  console.log(`Flow started (${label}): ${JSON.stringify(input)}`);
}

async function requeueCmd(sub: string, id: string, yes: boolean): Promise<void> {
  if (sub === "script") {
    const { data, error } = await db.from("episodes").select("id, title").eq("id", id).maybeSingle();
    if (error) { console.error("Error:", error.message); process.exit(1); }
    if (!data) { console.error(`Episode not found: ${id}`); process.exit(1); }
    console.log(`Episode: ${data.title} (${shortId(data.id)})`);
    await startFlowRecord("craftEpisodeSubmit", { episodeId: id, startFrom: "script", trigger: "manual" }, "script", yes);
  } else if (sub === "audio") {
    const { data, error } = await db.from("episodes").select("id, title").eq("id", id).maybeSingle();
    if (error) { console.error("Error:", error.message); process.exit(1); }
    if (!data) { console.error(`Episode not found: ${id}`); process.exit(1); }
    console.log(`Episode: ${data.title} (${shortId(data.id)})`);
    await startFlowRecord("craftEpisodeSubmit", { episodeId: id, startFrom: "audio", trigger: "manual" }, "audio", yes);
  } else if (sub === "rss") {
    const { data, error } = await db.from("episodes").select("id, title").eq("id", id).maybeSingle();
    if (error) { console.error("Error:", error.message); process.exit(1); }
    if (!data) { console.error(`Episode not found: ${id}`); process.exit(1); }
    console.log(`Episode: ${data.title} (${shortId(data.id)})`);
    await startFlowRecord("craftEpisodeDownload", { episodeId: id, startFrom: "rss", trigger: "manual" }, "rss", yes);
  } else if (sub === "regenerate-script") {
    const { data, error } = await db
      .from("episodes")
      .select("id, title")
      .eq("id", id)
      .maybeSingle();
    if (error) { console.error("Error:", error.message); process.exit(1); }
    if (!data) { console.error(`Episode not found: ${id}`); process.exit(1); }
    console.log(`Episode: ${data.title} (${shortId(data.id)})`);
    await startFlowRecord(
      "craftEpisodeSubmit",
      { episodeId: id, startFrom: "script", regenerate: true, trigger: "manual" },
      "regenerate-script",
      yes,
    );
  } else if (sub === "regenerate-audio") {
    const { data, error } = await db.from("episodes").select("id, title").eq("id", id).maybeSingle();
    if (error) { console.error("Error:", error.message); process.exit(1); }
    if (!data) { console.error(`Episode not found: ${id}`); process.exit(1); }
    console.log(`Episode: ${data.title} (${shortId(data.id)})`);
    await startFlowRecord(
      "craftEpisodeSubmit",
      { episodeId: id, startFrom: "audio", regenerate: true, trigger: "manual" },
      "regenerate-audio",
      yes,
    );
  } else {
    console.error("Usage: pnpm cli requeue script|audio|rss|regenerate-script|regenerate-audio <id> [--yes]");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const limit = flag("--limit", 10);
const outputFormat = (flagStr("--output") ?? flagStr("-o") ?? "long") as OutputFormat;

if (cmd === "list") {
  if (sub === "episodes") await listEpisodes(limit, outputFormat);
  else if (sub === "articles") await listArticles(limit, outputFormat);
  else if (sub === "audio") await listAudio(limit, outputFormat);
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
} else if (cmd === "requeue") {
  if (!sub || !param) {
    console.error("Usage: pnpm cli requeue script|audio|rss|regenerate-script|regenerate-audio <id> [--yes]");
    process.exit(1);
  }
  await requeueCmd(sub, param, flagBool("--yes"));
} else {
  usage();
}
