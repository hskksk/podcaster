# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Type checking (no test suite — this is the primary correctness check)
pnpm typecheck

# Local dev: start Supabase stack + Edge Functions
supabase start
pnpm functions:serve          # serves all Edge Functions with .env
pnpm pgflow:install           # install/upgrade pgflow schema objects (run once per environment)
pnpm pgflow:compile           # compile flows in supabase/flows to SQL

# Database
pnpm db:reset                 # wipe + replay all migrations (local only)
pnpm db:push                  # push new migrations to remote
supabase db query "<sql>"     # run ad-hoc SQL against local DB

# Post a test article through the pipeline (local)
pnpm test:post                # uses post-test-article.ts

# CLI tools
pnpm cli list episodes        # show recent episodes
pnpm cli status <article_id>  # show full pipeline state for one article
pnpm cli logs --status failure
pnpm cli requeue audio <episode_id>

# TUI (Ink/React terminal UI)
pnpm tui                      # connects to remote by default
TARGET=local pnpm tui         # connect to local Supabase

# Production deploy (one-command)
pnpm deploy
```

### Manually trigger Edge Functions locally

```bash
KEY=$(supabase status --json | python3 -c "import sys,json; print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")
curl -s http://localhost:54331/functions/v1/craft-episode-worker -H "Authorization: Bearer $KEY"
```

## Architecture

Article text enters via the `ingest` Edge Function and starts a **pgflow** DAG run:

```
ingest -> pgflow.start_flow("craftEpisode")
       -> generate_script
       -> generate_audio
       -> update_rss
```

In production, `pgflow_ensure_workers` (created by pgflow migrations) keeps `craft-episode-worker` alive and restarts it when needed.

### Edge worker pattern

The primary execution path is a pgflow worker edge function:

```ts
import { EdgeWorker } from "@pgflow/edge-worker";
import { CraftEpisode } from "../../flows/craft-episode.ts";

EdgeWorker.start(CraftEpisode);
```

Shared utilities live in `supabase/functions/_shared/`:
- `db.ts` — creates a `service_role` Supabase client from env vars
- `config.ts` — loads `podcast_config` table as a typed map
- `types.ts` — shared interfaces (`Article`, `Episode`, `Script`, `AudioFile`, etc.)
- `logger.ts` — `writeLog()` inserts to `processing_logs`
- `pipeline-stages.ts` — shared stage implementations used by pgflow tasks

### Runtime configuration

Podcast metadata and AI model settings are stored in the `podcast_config` table (key/value), not env vars. Workers call `loadConfig()` at runtime to read them. Change settings via Supabase Studio → Table Editor → `podcast_config`.

### Gemini integration

- **Script generation**: `generateScript` stage calls `gemini.models.generateContent` with `responseMimeType: "application/json"` and a `responseSchema` to force structured output. The script format is `Host: <line>\nCoHost: <line>` repeated.
- **TTS (audio generation)**: `generateAudio` stage calls the same API with a multi-speaker TTS model. The response is raw PCM; `pcmToWav()` in the stage implementation adds the WAV header before uploading to Storage.

### TARGET env var

Scripts in `scripts/` use `TARGET=local` to connect to the local Supabase stack via `scripts/lib/supabase-detect.ts`. Default is `remote`. The TUI and CLI both respect this.

### TUI

`pnpm tui` launches an [Ink](https://github.com/vadimdemedes/ink) (React) terminal UI. Entry point is `scripts/tui/index.tsx`. Data access goes through `scripts/tui/data/client.ts` (`DataClient`). Pass `--mock` to run with static fixture data (`scripts/tui/data/mock.ts`).

## Database Migrations

When creating a new table, always add `ENABLE ROW LEVEL SECURITY` immediately after:

```sql
create table my_table ( ... );
alter table my_table enable row level security;
```

Use `processing_logs` as the reference policy pattern:

```sql
-- Internal pipeline writes (service_role bypasses RLS automatically, so only needed for other roles)
create policy "service role insert" on my_table
  for insert to service_role with check (true);
-- Authenticated read access (for monitoring/UI)
create policy "authenticated read" on my_table
  for select to authenticated using (true);
```

Tables used exclusively by the internal pipeline can have RLS enabled with no policies — `service_role` bypasses RLS automatically in Supabase.

After creating a migration file, run `/security-review` to verify RLS and security settings before applying.
