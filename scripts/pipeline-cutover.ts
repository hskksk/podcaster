#!/usr/bin/env tsx
/**
 * Phase 4: production cutover helpers (preflight, mode switch, status).
 *
 * Usage:
 *   TARGET=local pnpm pipeline:preflight
 *   TARGET=local pnpm pipeline:status
 *   TARGET=local pnpm pipeline:switch -- events --yes
 *   TARGET=local pnpm pipeline:switch -- legacy --yes
 */
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { connectPostgres } from "./lib/postgres-connect.ts";
import {
  readPipelineMode,
  writePipelineMode,
  type PipelineMode,
} from "./lib/pipeline-mode.ts";

dotenv.config({ path: ".env" });

const args = process.argv.slice(2);
const command = args[0];

async function preflight(): Promise<void> {
  const sql = connectPostgres();

  const mode = await readPipelineMode(sql);
  console.log(`pipeline.mode = ${mode}`);

  const blocking = await sql<Array<{ id: string; status: string }>>`
    select id, status from episodes
    where status like '%running'
       or status in ('audio_generated', 'audio_downloading')
    order by created_at desc
    limit 20
  `;
  if (blocking.length > 0) {
    console.error("\nBlocking episodes (wait or fix before cutover):");
    for (const row of blocking) {
      console.error(`  ${row.id}  ${row.status}`);
    }
    await sql.end();
    process.exit(1);
  }
  console.log("No legacy pipeline runs blocking cutover.");

  const runningJobs = await sql<Array<{ id: string; job_type: string; status: string }>>`
    select id, job_type, status from jobs.jobs
    where status in ('requested', 'running', 'waiting_external')
    order by requested_at desc
    limit 10
  `;
  if (runningJobs.length > 0) {
    console.warn("\nActive jobs (informational):");
    for (const row of runningJobs) {
      console.warn(`  ${row.id}  ${row.job_type}  ${row.status}`);
    }
  }

  await sql.end();

  console.log("\nRunning events:reconcile …");
  execSync("pnpm events:reconcile", { stdio: "inherit", env: process.env });

  console.log("\nPreflight OK. Next: pnpm events:backfill (remote), reconcile again, then pipeline:switch events.");
}

async function status(): Promise<void> {
  const sql = connectPostgres();
  const mode = await readPipelineMode(sql);

  const [{ events }] = await sql<[{ events: string }]>`
    select count(*)::text as events from podcast.domain_events
  `;
  const [{ checkpoint }] = await sql<[{ checkpoint: string }]>`
    select last_processed_position::text as checkpoint
    from podcast.event_subscriptions
    where subscriber_id = 'production-policy'
    limit 1
  `;
  const [{ maxpos }] = await sql<[{ maxpos: string }]>`
    select coalesce(max(position), 0)::text as maxpos from podcast.domain_events
  `;
  const failures = await sql<Array<{ event_position: string; error_message: string }>>`
    select event_position::text, error_message
    from podcast.event_subscription_failures
    where subscriber_id = 'production-policy'
    order by failed_at desc
    limit 5
  `;
  const recentJobs = await sql<Array<{ job_type: string; status: string; n: string }>>`
    select job_type, status, count(*)::text as n
    from jobs.jobs
    group by job_type, status
    order by job_type, status
  `;

  console.log(`pipeline.mode = ${mode}`);
  console.log(`domain_events: ${events} rows, subscriber checkpoint ${checkpoint} / max position ${maxpos}`);
  if (failures.length > 0) {
    console.log("Recent subscription failures:");
    for (const f of failures) console.log(`  position ${f.event_position}: ${f.error_message}`);
  } else {
    console.log("No subscription failures recorded.");
  }
  if (recentJobs.length > 0) {
    console.log("jobs.jobs counts:");
    for (const row of recentJobs) console.log(`  ${row.job_type} ${row.status}: ${row.n}`);
  }

  await sql.end();
}

async function switchMode(): Promise<void> {
  const target = args[1] as PipelineMode | undefined;
  const yes = args.includes("--yes");
  if (target !== "events" && target !== "legacy") {
    console.error("Usage: pnpm pipeline:switch -- events|legacy [--yes]");
    process.exit(1);
  }

  const sql = connectPostgres();
  const current = await readPipelineMode(sql);
  console.log(`Current pipeline.mode = ${current}`);
  console.log(`Target pipeline.mode = ${target}`);

  if (current === target) {
    console.log("Already set; nothing to do.");
    await sql.end();
    return;
  }

  if (target === "events") {
    console.log("\nBefore switching to events, ensure:");
    console.log("  1. pnpm events:backfill (production) + pnpm events:reconcile");
    console.log("  2. pnpm pipeline:preflight passes");
    console.log("  3. domain-subscriber, publish, job-worker deployed");
    console.log("  4. Hosted Edge has DB access (Supabase sets SUPABASE_DB_URL automatically)");
  }

  if (!yes) {
    console.error("\nRefusing to change mode without --yes");
    await sql.end();
    process.exit(1);
  }

  await writePipelineMode(target, sql);
  await sql.end();
  console.log(`Updated pipeline.mode → ${target}`);

  if (target === "legacy") {
    console.warn(
      "Rollback: ingest uses craftEpisodeSubmit again. Episode work during legacy is NOT in the event log; backfill before re-enabling events.",
    );
  } else {
    console.log("Smoke test: ingest one article, confirm feed.xml and jobs.job_attempts.");
  }
}

async function main(): Promise<void> {
  switch (command) {
    case "preflight":
      await preflight();
      break;
    case "status":
      await status();
      break;
    case "switch":
      await switchMode();
      break;
    default:
      console.error(`Usage:
  pnpm pipeline:preflight
  pnpm pipeline:status
  pnpm pipeline:switch -- events|legacy [--yes]`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
