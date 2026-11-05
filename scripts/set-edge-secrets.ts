#!/usr/bin/env tsx
/**
 * Push audio-transcode Edge Function secrets from repo root .env (operator machine only).
 * Only allowlisted keys are sent; the rest of .env is never uploaded.
 * Not invoked by pnpm deploy — CI must not bulk-load secrets from GitHub.
 */
import dotenv from "dotenv";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { detectProjectRef } from "./lib/supabase-detect.ts";

const ALLOWED_KEYS = [
  "GEMINI_API_KEY",
  "GCP_SERVICE_ACCOUNT_JSON",
  "GCP_PROJECT_ID",
  "GCP_REGION",
  "GCP_RUN_JOB_NAME",
] as const;

if (process.env.TARGET === "local") {
  console.error("TARGET=local: Edge Secrets are not pushed to local Docker. Use root .env with pnpm functions:serve.");
  process.exit(1);
}

const envPath = resolve(".env");
if (!existsSync(envPath)) {
  console.error(".env not found. Copy .env.example and set GCP_* / GEMINI_API_KEY.");
  process.exit(1);
}

const parsed = dotenv.config({ path: envPath, processEnv: {} }).parsed ?? {};
const pairs = ALLOWED_KEYS
  .filter((key) => (parsed[key] ?? "").trim() !== "")
  .map((key) => `${key}=${parsed[key]}`);

if (pairs.length === 0) {
  console.error(`No allowlisted keys set in .env (${ALLOWED_KEYS.join(", ")}).`);
  process.exit(1);
}

const projectRef = detectProjectRef();
console.log(`Linking project ${projectRef} (if needed) and setting Edge secrets: ${pairs.map((p) => p.split("=")[0]).join(", ")} …`);
execFileSync("supabase", ["link", "--project-ref", projectRef], { stdio: "inherit" });
execFileSync("supabase", ["secrets", "set", ...pairs], { stdio: "inherit" });
console.log("Edge secrets updated (allowlisted keys only).");
