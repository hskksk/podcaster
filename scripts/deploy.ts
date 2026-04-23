#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function run(cmd: string, opts?: { env?: Record<string, string> }) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, {
    stdio: "inherit",
    env: { ...process.env, ...opts?.env },
  });
}

const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!projectRef) {
  console.error("SUPABASE_PROJECT_REF is not set. Check your .env.production file.");
  process.exit(1);
}

const envFile = existsSync(".env.production") ? ".env.production" : ".env.local";
console.log(`Using env file: ${envFile}`);

// 1. Link project (idempotent)
run(`supabase link --project-ref ${projectRef}`);

// 2. Push secrets
run(`supabase secrets set --env-file ${envFile}`);

// 3. Apply migrations
run("supabase db push");

// 4. Set database settings for pg_cron → Edge Functions
const functionsUrl = process.env.APP_FUNCTIONS_URL;
const serviceKey = process.env.APP_SERVICE_KEY;
if (functionsUrl && serviceKey) {
  run(
    `supabase db execute --file - <<'SQL'\nalter database postgres set app.functions_url = '${functionsUrl}';\nalter database postgres set app.service_key = '${serviceKey}';\nSQL`,
  );
}

// 5. Deploy all Edge Functions
run(
  "supabase functions deploy ingest generate-script generate-audio update-rss --no-verify-jwt",
);

console.log("\nDeploy complete.");
console.log(
  `Ingest URL: ${functionsUrl ?? "https://<ref>.supabase.co/functions/v1"}/ingest`,
);
