# Podcaster project overview
- Purpose: ingest article text (often from mem.ai note) and automatically generate conversational podcast scripts/audio and RSS feed.
- Core architecture: Supabase Edge Functions pipeline (`ingest` -> `generate-script` -> `generate-audio` -> `update-rss`) connected with Postgres `pgmq` queues.
- Main stack: TypeScript + Node tooling (`pnpm`, `tsx`), Supabase (Postgres, Storage, Edge Functions), Gemini API, mem.ai integration.
- Key directories: `scripts/` (CLI + operational scripts), `supabase/functions/` (runtime pipeline), `supabase/migrations/` (DB schema/queue setup), `.github/workflows/` (CI/CD automations), `articles/` (article markdown files).