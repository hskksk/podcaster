#!/usr/bin/env tsx
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const envFile = existsSync(".env.production") ? ".env.production" : ".env.local";
dotenv.config({ path: envFile });
console.log(`Using env file: ${envFile}`);

function run(cmd: string, opts?: { env?: Record<string, string> }) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...opts?.env } });
}

function runSql(label: string, sql: string) {
  console.log(`\n[sql] ${label}`);
  execSync("supabase db query", {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
    env: { ...process.env },
  });
}

function escapeSqlLiteral(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

function detectProjectRef(): string {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  try {
    const out = execSync("supabase projects list -o json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const projects: Array<{ id: string; name: string }> = JSON.parse(out);
    if (projects.length === 1) {
      console.log(`Auto-detected project: ${projects[0].name} (${projects[0].id})`);
      return projects[0].id;
    }
    if (projects.length > 1) {
      console.error(
        "複数のプロジェクトが見つかりました。SUPABASE_PROJECT_REF に対象プロジェクトの ID を設定してください:\n" +
          projects.map((p) => `  ${p.id}  ${p.name}`).join("\n"),
      );
      process.exit(1);
    }
  } catch {
    // login していない、または CLI が使えない場合
  }
  console.error(
    "SUPABASE_PROJECT_REF が未設定で、supabase projects list からも取得できませんでした。",
  );
  process.exit(1);
}

function detectServiceKey(projectRef: string): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const out = execSync(
      `supabase projects api-keys --project-ref ${projectRef} -o json`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    const keys: Array<{ name: string; api_key: string }> = JSON.parse(out);
    const entry = keys.find((k) => k.name === "service_role");
    if (entry?.api_key) {
      console.log("Auto-detected service_role key from supabase projects api-keys.");
      return entry.api_key;
    }
  } catch {
    // 取得失敗
  }
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY が未設定で、supabase projects api-keys からも取得できませんでした。",
  );
  process.exit(1);
}

const projectRef = detectProjectRef();
const serviceKey = detectServiceKey(projectRef);

// 1. Link project (idempotent)
run(`supabase link --project-ref ${projectRef}`);

// 2. Push secrets (edge function env vars)
run(`supabase secrets set --env-file ${envFile}`);

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
);

// 5. Create/replace pg_cron jobs (cron.schedule replaces jobs with the same name)
const functionsBase = `https://${projectRef}.supabase.co/functions/v1`;
runSql(
  "pg_cron: create drain jobs",
  `
do $$
begin
  perform cron.schedule(
    'drain-script-queue', '* * * * *',
    $job$
      select net.http_post(
        url     := '${functionsBase}/generate-script',
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
  perform cron.schedule(
    'drain-audio-queue', '* * * * *',
    $job$
      select net.http_post(
        url     := '${functionsBase}/generate-audio',
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
  perform cron.schedule(
    'drain-rss-queue', '* * * * *',
    $job$
      select net.http_post(
        url     := '${functionsBase}/update-rss',
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

// 6. Deploy all Edge Functions
run(
  "supabase functions deploy ingest generate-script generate-audio update-rss --no-verify-jwt",
);

// 7. Upload cover.png and seed podcast_config
const supabaseApiUrl = `https://${projectRef}.supabase.co`;
run("npx tsx scripts/seed-config.ts", {
  env: {
    SUPABASE_URL: supabaseApiUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  },
});

console.log("\nDeploy complete.");
console.log(`Ingest URL:  ${functionsBase}/ingest`);
console.log(
  `RSS feed:    https://${projectRef}.supabase.co/storage/v1/object/public/podcast/feed.xml`,
);
