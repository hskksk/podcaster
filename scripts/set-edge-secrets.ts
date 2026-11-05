#!/usr/bin/env tsx
/**
 * Push Edge Function secrets from repo root .env (operator machine only).
 * Not invoked by pnpm deploy — CI must not bulk-load secrets from GitHub.
 */
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { detectProjectRef } from "./lib/supabase-detect.ts";

dotenv.config({ path: ".env" });

if (process.env.TARGET === "local") {
  console.error("TARGET=local: Edge Secrets are not pushed to local Docker. Use root .env with pnpm functions:serve.");
  process.exit(1);
}

const envPath = resolve(".env");
if (!existsSync(envPath)) {
  console.error(".env not found. Copy .env.example and set GCP_* / GEMINI_API_KEY.");
  process.exit(1);
}

const projectRef = detectProjectRef();
console.log(`Linking project ${projectRef} (if needed) and setting Edge secrets from .env …`);
execSync(`supabase link --project-ref ${projectRef}`, { stdio: "inherit" });
execSync("supabase secrets set --env-file .env", { stdio: "inherit" });
console.log("Edge secrets updated from .env (keys present in the file only).");
