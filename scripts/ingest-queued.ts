#!/usr/bin/env tsx
/**
 * Ingest every content docs/web-clips index.mdoc with podcast: queued, then write
 * podcast: published + contentSha in the same process (GitHub Actions commits).
 *
 * Does not bulk-queue existing web-clips. Capture stays podcast: none.
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { parseFrontmatter, parseTitleFromContent, setFrontmatterFields, textify } from "./lib/mdoc.ts";
import { detectLocalStatus, detectProjectRef, detectServiceKey } from "./lib/supabase-detect.ts";

dotenv.config({ path: ".env" });

type QueuedFile = { rel: string; raw: string };

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function walkQueued(root: string, prefix: string, out: QueuedFile[]): void {
  if (!existsSync(root)) return;
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const rel = `${prefix}/${ent.name}/index.mdoc`;
    const full = path.join(root, ent.name, "index.mdoc");
    if (!existsSync(full)) continue;
    const raw = readFileSync(full, "utf8");
    const { attrs } = parseFrontmatter(raw);
    if (attrs.podcast === "queued") out.push({ rel, raw });
  }
}

function collectQueued(): QueuedFile[] {
  const files: QueuedFile[] = [];
  walkQueued(path.resolve("content/docs"), "content/docs", files);
  walkQueued(path.resolve("content/web-clips"), "content/web-clips", files);
  return files;
}

function ingestEndpoint(): { url: string; authKey: string } {
  const target = process.env.TARGET ?? "remote";
  if (target === "remote") {
    const projectRef = detectProjectRef();
    return {
      url: `https://${projectRef}.supabase.co/functions/v1/ingest`,
      authKey: detectServiceKey(projectRef),
    };
  }
  const { apiUrl, serviceKey } = detectLocalStatus();
  return { url: `${apiUrl}/functions/v1/ingest`, authKey: serviceKey };
}

function markPublished(rel: string, raw: string, contentSha: string): void {
  const next = setFrontmatterFields(raw, { podcast: "published", contentSha });
  writeFileSync(path.resolve(rel), next, "utf8");
}

async function ingestOne(
  file: QueuedFile,
  url: string,
  authKey: string,
): Promise<"ok" | "duplicate" | "fail"> {
  const { attrs } = parseFrontmatter(file.raw);
  const content = textify(file.raw);
  const title = attrs.title || parseTitleFromContent(content, file.rel);
  const contentSha = sha256(file.raw);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
    },
    body: JSON.stringify({
      title,
      content,
      content_path: file.rel,
      content_sha: contentSha,
      source_url: attrs.sourceUrl || attrs.url || undefined,
      ingest_route: "queued_ci",
      ingest_meta: {
        legacyFilename: attrs.legacyFilename || undefined,
        inbox_file: attrs.legacyFilename || undefined,
      },
    }),
  });
  if (res.status === 409) {
    console.log(`409 duplicate content_path: ${file.rel}`);
    return "duplicate";
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    console.error(`ingest failed ${res.status} ${file.rel}: ${text}`);
    return "fail";
  }
  console.log(`ingested ${file.rel} → ${res.status}`);
  return "ok";
}

const queued = collectQueued();
if (queued.length === 0) {
  console.log("No podcast: queued files.");
  process.exit(0);
}

console.log(`Found ${queued.length} queued file(s)`);
const { url, authKey } = ingestEndpoint();
let written = 0;
let failed = 0;

for (const file of queued) {
  const result = await ingestOne(file, url, authKey);
  if (result === "fail") {
    failed++;
    continue;
  }
  // 409: already in DB — still write published so the next push does not retry TTS.
  markPublished(file.rel, file.raw, sha256(file.raw));
  written++;
}

if (written > 0 && process.env.INGEST_QUEUED_COMMIT === "1") {
  execSync("git add content/docs content/web-clips", { stdio: "inherit" });
  const staged = execSync("git diff --cached --name-only", { encoding: "utf8" }).trim();
  if (staged) {
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
    execSync('git commit -m "chore: mark ingested queued files as published"', { stdio: "inherit" });
    execSync("git push", { stdio: "inherit" });
  }
}

if (failed > 0) {
  console.error(`${failed} ingest(s) failed; left podcast: queued`);
  process.exit(1);
}
