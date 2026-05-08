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
  const { apiUrl, serviceKey } = detectLocalStatus();
  // pg_net runs inside the Postgres Docker container, so 127.0.0.1 is unreachable.
  // host.docker.internal resolves to the host machine on macOS/Windows Docker.
  const functionsBase =
    apiUrl.replace("127.0.0.1", "host.docker.internal") + "/functions/v1";

  // 1. Upsert service_key in local Vault
  runSql(
    "vault: upsert service_key",
    `
do $$
declare
  v_id uuid;
  v_key text := ${escapeSqlLiteral(serviceKey)};
begin
  select id into v_id from vault.secrets where name = 'service_key' limit 1;
  if v_id is null then
    perform vault.create_secret(v_key, 'service_key', 'Service role key for pg_cron edge function calls');
  else
    perform vault.update_secret(v_id, v_key, 'service_key', 'Service role key for pg_cron edge function calls');
  end if;
end;
$$;
`,
  );

  // 2. Create/replace pg_cron jobs
  runSql(
    "pg_cron: create pgflow worker job",
    `
do $$
begin
  perform cron.schedule(
    'run-pgflow-worker', '*/1 * * * *',
    $job$
      select net.http_post(
        url     := '${functionsBase}/pgflow-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets where name = 'service_key'
          )
        ),
        body    := '{}'::jsonb
      );
    $job$
  );
end;
$$;
`,
  );

  // 3. Upload cover.png and seed podcast_config
  run("npx tsx scripts/seed-config.ts", { env: { TARGET: "local" } });

  console.log("\nLocal deploy complete.");
  console.log(`Ingest URL:  ${functionsBase}/ingest`);
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

  // 3. Apply migrations (20260424000001 drops old broken cron jobs)
  run("supabase db push");

  // 4. Upsert service_key in Supabase Vault
  runSql(
    "vault: upsert service_key",
    `
do $$
declare
  v_id uuid;
  v_key text := ${escapeSqlLiteral(serviceKey)};
begin
  select id into v_id from vault.secrets where name = 'service_key' limit 1;
  if v_id is null then
    perform vault.create_secret(v_key, 'service_key', 'Service role key for pg_cron edge function calls');
  else
    perform vault.update_secret(v_id, v_key, 'service_key', 'Service role key for pg_cron edge function calls');
  end if;
end;
$$;
`,
    "--linked",
  );

  // 5. Create/replace pg_cron jobs (cron.schedule replaces jobs with the same name)
  const functionsBase = `https://${projectRef}.supabase.co/functions/v1`;
  runSql(
    "pg_cron: create pgflow worker job",
    `
do $$
begin
  perform cron.schedule(
    'run-pgflow-worker', '* * * * *',
    $job$
      select net.http_post(
        url     := '${functionsBase}/pgflow-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets where name = 'service_key'
          )
        ),
        body    := '{}'::jsonb
      );
    $job$
  );
end;
$$;
`,
    "--linked",
  );

  // 6. Deploy all Edge Functions
  run(
    "supabase functions deploy ingest generate-script generate-audio update-rss pgflow-worker --no-verify-jwt",
  );

  // 7. Upload cover.png and seed podcast_config
  run("npx tsx scripts/seed-config.ts");

  console.log("\nDeploy complete.");
  console.log(`Ingest URL:  ${functionsBase}/ingest`);
  console.log(
    `RSS feed:    https://${projectRef}.supabase.co/storage/v1/object/public/podcast/feed.xml`,
  );
}
