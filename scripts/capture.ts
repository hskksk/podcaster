#!/usr/bin/env tsx
/**
 * Capture CLI — POST /api/capture (never calls ingest / TTS).
 *
 *   pnpm capture --title "Note" --file notes.md
 *   pnpm capture --title "Clip" --file page.md --url https://example.com
 *   pnpm capture --title "Wiki" --file note.md --collection docs
 *
 * Env: CAPTURE_API_URL (default http://127.0.0.1:3000), CAPTURE_API_TOKEN
 */

import dotenv from "dotenv";
import { readFileSync } from "node:fs";

dotenv.config({ path: ".env" });
dotenv.config({ path: "apps/web/.env.local" });

function usage(): never {
  console.error(`Usage:
  pnpm capture --title <title> --file <path> [--url <url>] [--slug <slug>] [--collection web-clips|docs] [--podcast none|queued|published|skipped]
  pnpm capture --patch --path content/web-clips/<slug>/index.mdoc --podcast queued`);
  process.exit(1);
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  if (!v || v.startsWith("-")) {
    console.error(`Missing value for ${name}`);
    process.exit(1);
  }
  return v;
}

const argv = process.argv.slice(2);
if (argv.includes("-h") || argv.includes("--help")) usage();

const apiUrl = (process.env.CAPTURE_API_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const token = process.env.CAPTURE_API_TOKEN?.trim();
if (!token) {
  console.error("CAPTURE_API_TOKEN is not set (root .env or apps/web/.env.local)");
  process.exit(1);
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

async function post(body: unknown, method: "POST" | "PATCH"): Promise<void> {
  const url = `${apiUrl}/api/capture`;
  console.log(`${method} ${url}`);
  const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep text
  }
  console.log(`Status: ${res.status}`, typeof parsed === "string" ? parsed : JSON.stringify(parsed));
  if (res.status === 202) {
    console.error("Accepted (retryable). Re-run the same command if the commit is missing.");
  }
  if (!res.ok && res.status !== 202) process.exit(1);
}

if (argv.includes("--patch")) {
  const path = flag(argv, "--path");
  const podcast = flag(argv, "--podcast");
  if (!path || !podcast) usage();
  await post({ path, podcast }, "PATCH");
} else {
  const title = flag(argv, "--title");
  const file = flag(argv, "--file");
  if (!title || !file) usage();
  const content = readFileSync(file, "utf8");
  await post(
    {
      title,
      content,
      url: flag(argv, "--url"),
      slug: flag(argv, "--slug"),
      collection: flag(argv, "--collection") ?? "web-clips",
      podcast: flag(argv, "--podcast") ?? "none",
    },
    "POST",
  );
}
