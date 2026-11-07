#!/usr/bin/env tsx
/**
 * One-off migration: transcode legacy delivery WAV blobs to m4a (Cloud Run ffmpeg)
 * without re-running Gemini TTS. Updates podcast.audios → blob_id; optionally
 * republishes RSS for affected episodes.
 *
 * Prerequisites (remote):
 *   - GCP_* and GCP_SERVICE_ACCOUNT_JSON in .env (same as Edge transcode)
 *   - Cloud Run Job audio-transcode deployed
 *   - DATABASE_URL or SUPABASE_DB_PASSWORD + link
 *
 * Usage:
 *   TARGET=remote pnpm migrate:legacy-wav --dry-run
 *   TARGET=remote pnpm migrate:legacy-wav --limit 5 --yes
 *   TARGET=remote pnpm migrate:legacy-wav --episode <episode_uuid> --yes
 *   TARGET=remote pnpm migrate:legacy-wav --published-only --republish --delete-wav --yes
 *   TARGET=remote pnpm migrate:legacy-wav --delete-wav-only --dry-run
 *   TARGET=remote pnpm migrate:legacy-wav --delete-wav-only --yes
 */
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { connectPostgres } from "./lib/postgres-connect.ts";
import { loadPodcastConfigMap } from "./lib/production-profile.ts";
import {
  publishEpisodeViaEdge,
} from "./lib/domain-requeue.ts";
import {
  detectLocalStatus,
  detectProjectRef,
  detectServiceKey,
} from "./lib/supabase-detect.ts";
import { printLong, shortId, truncate } from "./lib/table.ts";
import {
  assertGcpRunPlacement,
  pollCloudRunExecution,
  submitCloudRunTranscode,
  CLOUD_RUN_FAILURE_STATES,
  CLOUD_RUN_SUCCESS_STATES,
} from "./lib/gcp-run.ts";
import {
  createSignedDownloadUrl,
  createSignedUploadUrl,
  resolveObjectByteSize,
  storageObjectExists,
} from "./lib/storage-signed-urls.ts";

dotenv.config({ path: ".env" });

function flag(name: string, defaultVal: number): number {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1]) return parseInt(args[i + 1], 10) || defaultVal;
  return defaultVal;
}

function flagStr(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("-")) return args[i + 1];
  return undefined;
}

function flagBool(name: string): boolean {
  return process.argv.slice(2).includes(name);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function transcodeBitrateKbps(cfg: Record<string, unknown>): number {
  const n = Number(cfg["audio.transcode.bitrate_kbps"] ?? 128);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 128;
}

type MigrateTarget = {
  audio_id: string;
  script_id: string;
  episode_id: string;
  episode_title: string | null;
  blob_id: string;
  storage_path: string;
  byte_size: number;
  duration_ms: number | null;
  has_active_publication: boolean;
  published_revision_id: string | null;
};

type OrphanWavBlob = {
  blob_id: string;
  storage_path: string;
  byte_size: number;
};

const TARGETS_QUERY = `
  select
    a.id as audio_id,
    a.script_id,
    p.episode_id,
    s.title as episode_title,
    b.id as blob_id,
    b.storage_path,
    b.byte_size::bigint as byte_size,
    a.duration_ms,
    (pub.id is not null) as has_active_publication,
    pub.episode_revision_id as published_revision_id
  from podcast.audios a
  join podcast.blobs b on b.id = a.blob_id
  join podcast.productions p on p.id = a.production_id
  join podcast.scripts s on s.id = a.script_id
  left join lateral (
    select pub.id, er.id as episode_revision_id
    from podcast.episode_revisions er
    join podcast.episode_publications pub on pub.episode_revision_id = er.id
    where er.audio_id = a.id and pub.withdrawn_at is null
    order by pub.published_at desc
    limit 1
  ) pub on true
  where b.mime_type = 'audio/wav'
`;

async function loadTargets(
  sql: ReturnType<typeof connectPostgres>,
  opts: {
    episodeId?: string;
    publishedOnly: boolean;
    limit: number;
  },
): Promise<MigrateTarget[]> {
  const max = opts.limit > 0 ? opts.limit : 10_000;
  let extra = "";
  const values: (string | number)[] = [];
  if (opts.episodeId) {
    extra += ` and p.episode_id = $${values.length + 1}::uuid`;
    values.push(opts.episodeId);
  }
  if (opts.publishedOnly) {
    extra += " and pub.id is not null";
  }
  const limitParam = values.length + 1;
  values.push(max);
  const q = `${TARGETS_QUERY}${extra} order by a.created_at asc limit $${limitParam}`;
  return sql.unsafe(q, values) as unknown as Promise<MigrateTarget[]>;
}

const ORPHAN_WAV_QUERY = `
  select
    b.id as blob_id,
    b.storage_path,
    b.byte_size::bigint as byte_size
  from podcast.blobs b
  where b.mime_type = 'audio/wav'
    and not exists (select 1 from podcast.audios a where a.blob_id = b.id)
`;

async function loadOrphanWavBlobs(
  sql: ReturnType<typeof connectPostgres>,
  opts: { episodeId?: string; limit: number },
): Promise<OrphanWavBlob[]> {
  const max = opts.limit > 0 ? opts.limit : 10_000;
  let extra = "";
  const values: (string | number)[] = [];
  if (opts.episodeId) {
    const exact = `audio/${opts.episodeId}.wav`;
    const prefix = `audio/${opts.episodeId}/%`;
    extra += ` and (b.storage_path = $${values.length + 1} or b.storage_path like $${values.length + 2})`;
    values.push(exact, prefix);
  }
  const limitParam = values.length + 1;
  values.push(max);
  const q = `${ORPHAN_WAV_QUERY}${extra} order by b.created_at asc limit $${limitParam}`;
  return sql.unsafe(q, values) as unknown as Promise<OrphanWavBlob[]>;
}

async function deleteLegacyWavBlob(
  sql: ReturnType<typeof connectPostgres>,
  db: ReturnType<typeof supabaseClient>,
  blob: OrphanWavBlob,
  dryRun: boolean,
): Promise<void> {
  const [{ refs }] = await sql<Array<{ refs: string }>>`
    select count(*)::text as refs
    from podcast.audios a
    where a.blob_id = ${blob.blob_id}::uuid
  `;
  if (Number(refs) > 0) {
    throw new Error(`blob ${blob.blob_id} is still referenced by podcast.audios`);
  }

  if (dryRun) {
    console.log(`  [dry-run] delete  ${blob.storage_path}  (blob ${shortId(blob.blob_id)})`);
    return;
  }

  const { error: storageErr } = await db.storage.from("podcast").remove([blob.storage_path]);
  if (storageErr) {
    console.warn(`  storage delete failed: ${blob.storage_path} (${storageErr.message})`);
  }
  await sql`delete from podcast.blobs where id = ${blob.blob_id}::uuid`;
  console.log(`  removed  ${blob.storage_path}`);
}

function supabaseClient() {
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
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

async function waitForTranscode(executionName: string): Promise<void> {
  const deadline = Date.now() + 25 * 60 * 1000;
  while (Date.now() < deadline) {
    const { state } = await pollCloudRunExecution(executionName);
    if (CLOUD_RUN_SUCCESS_STATES.has(state)) return;
    if (CLOUD_RUN_FAILURE_STATES.has(state)) {
      throw new Error(`Cloud Run execution failed: ${state}`);
    }
    await sleep(8_000);
  }
  throw new Error(`Cloud Run execution timed out: ${executionName}`);
}

async function migrateOne(
  sql: ReturnType<typeof connectPostgres>,
  db: ReturnType<typeof supabaseClient>,
  target: MigrateTarget,
  bitrateKbps: number,
  opts: { deleteWav: boolean },
): Promise<{ republishRevisionId: string | null }> {
  const outputStoragePath = `audio/${target.episode_id}/migrated-${target.audio_id}.m4a`;
  const attemptId = randomUUID();
  const jobId = `migrate-${target.audio_id}`;

  const wavExists = await storageObjectExists(db, target.storage_path);
  if (!wavExists) {
    throw new Error(`WAV missing in storage: ${target.storage_path}`);
  }

  const m4aExists = await storageObjectExists(db, outputStoragePath);
  if (!m4aExists) {
    const inputUrl = await createSignedDownloadUrl(db, target.storage_path);
    const outputUrl = await createSignedUploadUrl(db, outputStoragePath);
    const executionName = await submitCloudRunTranscode({
      wavStoragePath: target.storage_path,
      outputStoragePath,
      jobId,
      attemptId,
      bitrateKbps,
      signedInputUrl: inputUrl,
      signedOutputUrl: outputUrl,
    });
    console.log(`  transcode submitted  ${shortId(target.audio_id)}  ${executionName.split("/").pop()}`);
    await waitForTranscode(executionName);
  } else {
    console.log(`  transcode skip (m4a exists)  ${shortId(target.audio_id)}  ${outputStoragePath}`);
  }

  const byteSize = await resolveObjectByteSize(db, outputStoragePath);
  const newBlobId = randomUUID();

  await sql.begin(async (tx) => {
    await tx`
      insert into podcast.blobs (id, storage_path, mime_type, byte_size, produced_by_attempt_id)
      values (
        ${newBlobId}::uuid,
        ${outputStoragePath},
        'audio/mp4',
        ${byteSize}::bigint,
        null
      )
    `;
    await tx`
      update podcast.audios
      set blob_id = ${newBlobId}::uuid
      where id = ${target.audio_id}::uuid
    `;
  });

  if (opts.deleteWav) {
    await deleteLegacyWavBlob(
      sql,
      db,
      { blob_id: target.blob_id, storage_path: target.storage_path, byte_size: target.byte_size },
      false,
    ).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  kept legacy wav blob: ${message}`);
    });
  }

  console.log(
    `  migrated  ${shortId(target.episode_id)}  ${truncate(target.episode_title ?? "", 36)}  ` +
      `${byteSize} bytes  ${outputStoragePath}`,
  );

  return {
    republishRevisionId: target.has_active_publication ? target.published_revision_id : null,
  };
}

async function runDeleteWavOnly(opts: {
  dryRun: boolean;
  yes: boolean;
  limit: number;
  episodeId?: string;
}): Promise<void> {
  const sql = connectPostgres();
  const db = supabaseClient();
  const orphans = await loadOrphanWavBlobs(sql, {
    episodeId: opts.episodeId,
    limit: opts.limit > 0 ? opts.limit : 10_000,
  });
  await sql.end();

  if (orphans.length === 0) {
    console.log("No unreferenced audio/wav blobs in podcast.blobs.");
    return;
  }

  console.log(`${orphans.length} unreferenced WAV blob row(s) (not pointed to by podcast.audios).`);
  printLong(orphans.map((b) => ({
    "Blob ID": b.blob_id,
    "Storage path": b.storage_path,
    "Bytes": String(b.byte_size),
  })));

  if (opts.dryRun) {
    console.log("Dry run: pass --yes to delete Storage objects and blob rows.");
    const sqlDry = connectPostgres();
    for (const b of orphans) {
      await deleteLegacyWavBlob(sqlDry, db, b, true);
    }
    await sqlDry.end();
    return;
  }

  if (!opts.yes) {
    const ok = await confirm(`Delete ${orphans.length} orphan WAV blob(s) from Storage and DB?`);
    if (!ok) {
      console.log("Aborted.");
      return;
    }
  }

  const sqlWork = connectPostgres();
  let deleted = 0;
  let failed = 0;
  for (const b of orphans) {
    try {
      await deleteLegacyWavBlob(sqlWork, db, b, false);
      deleted++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  failed  ${b.storage_path}  ${message}`);
    }
  }
  await sqlWork.end();
  console.log(`Done: ${deleted} removed, ${failed} failed.`);
}

async function main(): Promise<void> {
  const dryRun = flagBool("--dry-run");
  const yes = flagBool("--yes");
  const publishedOnly = flagBool("--published-only");
  const deleteWav = flagBool("--delete-wav");
  const deleteWavOnly = flagBool("--delete-wav-only");
  const republish = flagBool("--republish");
  const limit = flag("--limit", 0);
  const episodeId = flagStr("--episode");

  if (deleteWavOnly) {
    await runDeleteWavOnly({ dryRun, yes, limit, episodeId });
    return;
  }

  if (!dryRun) {
    assertGcpRunPlacement();
    if (!process.env.GCP_SERVICE_ACCOUNT_JSON?.trim()) {
      console.error("GCP_SERVICE_ACCOUNT_JSON is required (see infra/gcp/audio-transcode/README.md).");
      process.exit(1);
    }
  }

  const sql = connectPostgres();
  const db = supabaseClient();
  const cfg = await loadPodcastConfigMap(sql);
  const bitrateKbps = transcodeBitrateKbps(cfg);

  const targets = await loadTargets(sql, {
    episodeId,
    publishedOnly,
    limit: limit > 0 ? limit : 10_000,
  });
  await sql.end();

  if (targets.length === 0) {
    console.log("No legacy WAV audio rows matched.");
    return;
  }

  console.log(
    `${targets.length} audio row(s) with mime audio/wav` +
      `${publishedOnly ? " (active publication only)" : ""}.`,
  );
  printLong(targets.map((t) => ({
    "Audio ID": t.audio_id,
    "Episode": t.episode_id,
    "Title": truncate(t.episode_title ?? "", 50),
    "WAV path": t.storage_path,
    "Published": t.has_active_publication ? "yes" : "no",
  })));

  if (dryRun) {
    console.log("Dry run: planned output paths (--yes to execute).");
    for (const t of targets) {
      const out = `audio/${t.episode_id}/migrated-${t.audio_id}.m4a`;
      console.log(`  ${shortId(t.audio_id)}  ${t.storage_path} → ${out}`);
    }
    return;
  }

  if (!yes) {
    const ok = await confirm(
      `Transcode ${targets.length} WAV row(s) to m4a and update podcast.audios?`,
    );
    if (!ok) {
      console.log("Aborted.");
      return;
    }
  }

  const sqlWork = connectPostgres();
  let ok = 0;
  let failed = 0;
  const republishPairs = new Map<string, string>();

  for (const t of targets) {
    try {
      const { republishRevisionId } = await migrateOne(sqlWork, db, t, bitrateKbps, {
        deleteWav,
      });
      ok++;
      if (republishRevisionId) {
        republishPairs.set(t.episode_id, republishRevisionId);
      }
      await sleep(1_500);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  failed  ${shortId(t.audio_id)}  ${message}`);
    }
  }
  await sqlWork.end();

  console.log(`Done: ${ok} migrated, ${failed} failed.`);

  if (republish && republishPairs.size > 0) {
    console.log(`Republishing RSS for ${republishPairs.size} episode(s)...`);
    for (const [epId, revId] of republishPairs) {
      const result = await publishEpisodeViaEdge(epId, revId);
      if (!result.ok) {
        console.error(`  publish failed ${shortId(epId)}: ${result.status} ${result.body}`);
      } else {
        console.log(`  feed updated  ${shortId(epId)}`);
      }
      await sleep(500);
    }
  } else if (republishPairs.size > 0) {
    console.log("Republish skipped (pass --republish). Episodes with active publication:");
    for (const [epId] of republishPairs) {
      console.log(`  pnpm cli requeue rss ${epId} --yes`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
