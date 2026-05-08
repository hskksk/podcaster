#!/usr/bin/env tsx
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { detectLocalStatus, detectProjectRef, detectServiceKey } from "./lib/supabase-detect.ts";

dotenv.config({ path: ".env" });
console.log("Using env file: .env");

function run(cmd: string, opts?: { env?: Record<string, string> }) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...opts?.env } });
}

function runSql(label: string, sql: string, flags = "--local") {
  console.log(`\n[sql] ${label}`);
  execSync(`supabase db query ${flags}`, {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
    env: { ...process.env },
  });
}

function escapeSqlLiteral(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

const isLocal = process.env.TARGET === "local";

if (isLocal) {
  // ---- Local deployment ----
  const { apiUrl } = detectLocalStatus();

  // Register worker function for pgflow worker management
  runSql(
    "pgflow: track worker function",
    `
do $$
begin
  perform pgflow.track_worker_function('craft-episode-worker');
end;
$$;
`,
  );

  // Upload cover.png and seed podcast_config
  run("npx tsx scripts/seed-config.ts", { env: { TARGET: "local" } });

  console.log("\nLocal deploy complete.");
  console.log(`Ingest URL:  ${apiUrl}/functions/v1/ingest`);
  console.log(
    `RSS feed:    ${apiUrl}/storage/v1/object/public/podcast/feed.xml`,
  );
} else {
  // ---- Remote deployment ----
  const projectRef = detectProjectRef();
  const serviceKey = detectServiceKey(projectRef);

  // 1. Link project (idempotent)
  const passwordFlag = process.env.SUPABASE_DB_PASSWORD
    ? ` --password ${process.env.SUPABASE_DB_PASSWORD}`
    : "";
  run(`supabase link --project-ref ${projectRef}${passwordFlag}`);

  // 2. Push secrets (edge function env vars)
  run("supabase secrets set --env-file .env");
  run(`supabase secrets set PGFLOW_AUTH_SECRET=${JSON.stringify(serviceKey)}`);

  // 3. Apply migrations (20260424000001 drops old broken cron jobs)
  run("supabase db push");

  // 4. Upsert pgflow worker-management secrets in Supabase Vault
  runSql(
    "vault: upsert supabase_project_id",
    `
do $$
declare
  v_id uuid;
  v_value text := ${escapeSqlLiteral(projectRef)};
begin
  select id into v_id from vault.secrets where name = 'supabase_project_id' limit 1;
  if v_id is null then
    perform vault.create_secret(v_value, 'supabase_project_id', 'Supabase project ID for pgflow worker management');
  else
    perform vault.update_secret(v_id, v_value, 'supabase_project_id', 'Supabase project ID for pgflow worker management');
  end if;
end;
$$;
`,
    "--linked",
  );

  runSql(
    "vault: upsert pgflow_auth_secret",
    `
do $$
declare
  v_id uuid;
  v_value text := ${escapeSqlLiteral(serviceKey)};
begin
  select id into v_id from vault.secrets where name = 'pgflow_auth_secret' limit 1;
  if v_id is null then
    perform vault.create_secret(v_value, 'pgflow_auth_secret', 'Auth secret for pgflow ensure_workers HTTP calls');
  else
    perform vault.update_secret(v_id, v_value, 'pgflow_auth_secret', 'Auth secret for pgflow ensure_workers HTTP calls');
  end if;
end;
$$;
`,
    "--linked",
  );

  const functionsBase = `https://${projectRef}.supabase.co/functions/v1`;

  // Deploy Edge Functions
  run(
    "supabase functions deploy ingest craft-episode-worker pgflow --no-verify-jwt",
  );

  // Register worker function for pgflow worker management
  runSql(
    "pgflow: track worker function",
    `
do $$
begin
  perform pgflow.track_worker_function('craft-episode-worker');
end;
$$;
`,
    "--linked",
  );

  // Upload cover.png and seed podcast_config
  run("npx tsx scripts/seed-config.ts");

  console.log("\nDeploy complete.");
  console.log(`Ingest URL:  ${functionsBase}/ingest`);
  console.log(
    `RSS feed:    https://${projectRef}.supabase.co/storage/v1/object/public/podcast/feed.xml`,
  );
}
