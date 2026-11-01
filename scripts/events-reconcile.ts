#!/usr/bin/env tsx
/**
 * Compare legacy public tables with podcast.* projections after backfill.
 */
import dotenv from "dotenv";
import { connectPostgres } from "./lib/postgres-connect.ts";

dotenv.config({ path: ".env" });

async function main(): Promise<void> {
  const sql = connectPostgres();
  let failed = false;

  const [{ legacy_articles }] = await sql<[{ legacy_articles: string }]>`
    select count(*)::text as legacy_articles from articles
  `;
  const [{ proj_articles }] = await sql<[{ proj_articles: string }]>`
    select count(*)::text as proj_articles from podcast.articles
  `;
  if (legacy_articles !== proj_articles) {
    console.error(`articles count: legacy=${legacy_articles} projection=${proj_articles}`);
    failed = true;
  }

  const [{ legacy_episodes }] = await sql<[{ legacy_episodes: string }]>`
    select count(*)::text as legacy_episodes from episodes
  `;
  const [{ proj_episodes }] = await sql<[{ proj_episodes: string }]>`
    select count(*)::text as proj_episodes from podcast.episodes
  `;
  if (legacy_episodes !== proj_episodes) {
    console.error(`episodes count: legacy=${legacy_episodes} projection=${proj_episodes}`);
    failed = true;
  }

  const guidMismatches = await sql<
    Array<{ id: string; legacy_guid: string; proj_guid: string }>
  >`
    select e.id, e.id as legacy_guid, pe.guid as proj_guid
    from episodes e
    join podcast.episodes pe on pe.id = e.id
    where pe.guid <> e.id::text
  `;
  if (guidMismatches.length > 0) {
    console.error("GUID mismatches:", guidMismatches);
    failed = true;
  }

  const audioPathMismatches = await sql<
    Array<{ episode_id: string; legacy_path: string; proj_path: string }>
  >`
    select
      af.episode_id,
      af.storage_path as legacy_path,
      b.storage_path as proj_path
    from audio_files af
    join podcast.audios a on a.id = af.id
    join podcast.blobs b on b.id = a.blob_id
    where af.status = 'ready' and b.storage_path <> af.storage_path
  `;
  if (audioPathMismatches.length > 0) {
    console.error("audio path mismatches:", audioPathMismatches);
    failed = true;
  }

  const pubMismatches = await sql<
    Array<{ id: string; legacy_at: Date | null; proj_at: Date | null }>
  >`
    select
      e.id,
      e.published_at as legacy_at,
      ep.published_at as proj_at
    from episodes e
    join podcast.episode_revisions er on er.episode_id = e.id
    join podcast.episode_publications ep on ep.episode_revision_id = er.id
    where e.status = 'published'
      and (
        e.published_at is distinct from ep.published_at
      )
  `;
  if (pubMismatches.length > 0) {
    console.error("published_at mismatches:", pubMismatches);
    failed = true;
  }

  if (failed) {
    await sql.end();
    process.exit(1);
  }

  console.log("Reconciliation OK: counts, GUIDs, audio paths, and published_at match.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
