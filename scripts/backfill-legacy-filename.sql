-- Optional Phase 1b backfill: copy ingest_meta.inbox_file onto legacyFilename
-- so Pages audio map can match content/docs frontmatter.
-- Existing rows already keyed by inbox_file; build-web ORs both.
-- Run against remote only if COALESCE in scripts/build-web.ts is not enough:
--   supabase db query --linked -f scripts/backfill-legacy-filename.sql

UPDATE articles
SET ingest_meta = ingest_meta || jsonb_build_object(
  'legacyFilename',
  ingest_meta->>'inbox_file'
)
WHERE ingest_meta->>'inbox_file' IS NOT NULL
  AND (
    ingest_meta->>'legacyFilename' IS NULL
    OR ingest_meta->>'legacyFilename' = ''
  );
