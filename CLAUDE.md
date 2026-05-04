# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Type checking (no test suite — this is the primary correctness check)
pnpm typecheck

# Local dev: start Supabase stack + Edge Functions
supabase start
pnpm functions:serve          # serves all Edge Functions with .env

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
curl -s http://localhost:54331/functions/v1/generate-script -H "Authorization: Bearer $KEY"
curl -s http://localhost:54331/functions/v1/generate-audio  -H "Authorization: Bearer $KEY"
curl -s http://localhost:54331/functions/v1/update-rss      -H "Authorization: Bearer $KEY"
```

## Architecture

Article text enters via the `ingest` Edge Function and flows through a 4-stage pipeline connected by **pgmq** queues:

```
ingest → [script-queue] → generate-script → [audio-queue] → generate-audio → [rss-queue] → update-rss
```

Each stage is a Supabase Edge Function (Deno) invoked by `pg_cron` every minute in production. In development, call them manually in sequence. On failure, pgmq's visibility timeout causes automatic retry.

### Edge Function pattern

Every worker function follows the same structure:

```ts
Deno.serve(async (_req) => {
  EdgeRuntime.waitUntil(processQueue());  // non-blocking — response returns immediately
  return Response.json({ ok: true });
});

async function processQueue() {
  const db = createSupabaseClient();
  const msg = await queueRead(db, "<queue-name>");  // reads 1 message, sets 30-min visibility lock
  if (!msg) return;
  try {
    // do work...
    await queueDelete(db, "<queue-name>", msg.msg_id);  // ack on success
    await writeLog(db, { ..., status: "success" });
  } catch (err) {
    await queueDelete(db, "<queue-name>", msg.msg_id);  // also ack on failure (no infinite retry)
    await writeLog(db, { ..., status: "failure" });
  }
}
```

Shared utilities live in `supabase/functions/_shared/`:
- `db.ts` — creates a `service_role` Supabase client from env vars
- `queue.ts` — `queueRead` / `queueSend` / `queueDelete` wrappers over pgmq RPCs
- `config.ts` — loads `podcast_config` table as a typed map
- `types.ts` — shared interfaces (`Article`, `Episode`, `Script`, `AudioFile`, etc.)
- `logger.ts` — `writeLog()` inserts to `processing_logs`

### Runtime configuration

Podcast metadata and AI model settings are stored in the `podcast_config` table (key/value), not env vars. Workers call `loadConfig()` at runtime to read them. Change settings via Supabase Studio → Table Editor → `podcast_config`.

### Gemini integration

- **Script generation**: `generate-script` calls `gemini.models.generateContent` with `responseMimeType: "application/json"` and a `responseSchema` to force structured output. The script format is `Host: <line>\nCoHost: <line>` repeated.
- **TTS (audio generation)**: `generate-audio` calls the same API with a multi-speaker TTS model. The response is raw PCM; `pcmToWav()` in the function adds the WAV header before uploading to Storage.

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
