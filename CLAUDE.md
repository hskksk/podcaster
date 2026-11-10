# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Type checking (no test suite — this is the primary correctness check)
pnpm typecheck
pnpm typecheck:web            # Next.js / Keystatic app
pnpm web:dev                  # Keystatic admin at http://127.0.0.1:3000/keystatic
pnpm capture --title ... --file ...   # POST /api/capture (Git only, no TTS)
pnpm ingest:queued                    # ingest podcast: queued files (Phase 3)
pnpm mcp                              # FastMCP stdio (search_docs / write_clip / queue_podcast)

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
pnpm cli backfill images     # ProductionRequested scope=artwork for published episodes missing artwork
pnpm migrate:legacy-wav      # transcode legacy WAV→m4a; --delete-wav-only drops orphan wav blobs

# TUI (Ink/React terminal UI)
pnpm tui                      # connects to remote by default
TARGET=local pnpm tui         # connect to local Supabase

# Production console (English UI, loopback only, remote project via the Supabase CLI)
pnpm ops                      # http://127.0.0.1:5180  — supabase login, then the linked project

# Production deploy (one-command)
pnpm deploy
```

### Manually trigger Edge Functions locally

```bash
KEY=$(supabase status -o json | python3 -c "import sys,json; print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")
curl -s http://localhost:54331/functions/v1/domain-subscriber -H "Authorization: Bearer $KEY"
curl -s http://localhost:54331/functions/v1/job-worker -H "Authorization: Bearer $KEY"
```

## Architecture

Git + Markdoc (`content/`) is the designed knowledge store. Wiki lives in `content/docs/**/index.mdoc`, clips in `content/web-clips/**/index.mdoc`. Keystatic edits those files. The public site is Next.js (`apps/web`): `/` is the hskksk portal, `/podcast` is the wiki and podcast, and `/juken` publishes `chugaku-juken/`.

Production podcast pipeline (events + jobs):

```
ingest -> domain events (ArticleRegistered, EpisodeOpened, ProductionRequested)
       -> domain-subscriber (ProductionPolicy)
       -> jobs.jobs (write_script | render_audio | paint_artwork)
       -> job-worker (pgflow runJob)
       -> domain events (ScriptWritten, AudioRendered, …)
       -> assemble / publish -> feed.xml
```

`pgflow_ensure_workers` keeps `job-worker` and `domain-subscriber` alive.

### Edge worker pattern

Job execution uses a pgflow worker edge function:

```ts
import { EdgeWorker } from "@pgflow/edge-worker";
import { RunJob } from "../../flows/run-job.ts";

EdgeWorker.start(RunJob);
```

Event-driven policy uses `domain-subscriber` → `handleProductionPolicyEvent` in `_services/production-policy-handler.ts`.

Shared utilities live in `supabase/functions/_shared/`:
- `db.ts` — creates a `service_role` Supabase client from env vars
- `config.ts` — loads `podcast_config` table as a typed map (generator/tts/image keys)
- `types.ts` — legacy TypeScript shapes still used in a few places

CLI/TUI/web read **`podcast.*_overview`** views and **`jobs.attempt_log`**. Legacy `public.*` pipeline tables are removed in a follow-up migration; show metadata lives in **`podcast.shows`**.

### Runtime configuration

Show metadata lives in `podcast.shows` (from `ShowConfigured`). AI model settings remain in `podcast_config` and `jobs.prompt_templates`. Workers call `loadConfig()` at runtime.

### Gemini integration

- **Script generation**: `write_script` job handler uses Gemini structured JSON output (`Host:` / `CoHost:` lines).
- **TTS**: `render_audio` submits a Gemini Batch job; `external-operation-poller` completes waiting jobs.
- **Artwork**: `paint_artwork` job handler when enabled in profile.

### TARGET env var

Scripts in `scripts/` use `TARGET=local` to connect to the local Supabase stack via `scripts/lib/supabase-detect.ts`. Default is `remote`. The TUI and CLI both respect this.

### TUI

`pnpm tui` launches an [Ink](https://github.com/vadimdemedes/ink) (React) terminal UI. Entry point is `scripts/tui/index.tsx`. Data access goes through `scripts/tui/data/client.ts` (`DataClient`). Pass `--mock` to run with static fixture data (`scripts/tui/data/mock.ts`).

## Skills

Skills live in **`.agents/skills/<name>/`** — that is the single source of truth. `.claude/skills/<name>` is a **symlink** into it so Claude Code picks the same files up:

```bash
ln -s ../../.agents/skills/<name> .claude/skills/<name>
```

Never keep a second copy of a skill under `.claude/skills/`. Other agents (Cursor and anything else reading `.agents/`) load the `.agents/` copy, so a duplicated directory silently diverges and the two harnesses run different versions of the same skill.

A skill that calls another, and a skill that other skills call, follow `skill-orchestration`. Name the skill and when to read it. Do not name files inside it.

**External skills** from [hskksk/agent-skills](https://skills.sh/hskksk/agent-skills) (`japanese-writing`, `how-to-survey`, `survey-report`, `skill-orchestration`) install into `.agents/skills/` via `npx skills add hskksk/agent-skills --skill <name>`. `podcast-research2` loads `how-to-survey`, `survey-report`, and (for Japanese prose) `japanese-writing` by skill name. It does not ship copies of their references.

The external [`infographic-syntax-creator`](https://skills.sh/antvis/infographic) skill from `antvis/Infographic` generates AntV Infographic DSL only. Install it with `npx skills add antvis/infographic --skill infographic-syntax-creator`. Use this syntax-only skill for structured infographic authoring; do not substitute the sibling HTML-generating skill when the caller owns storage and rendering.

## Database Migrations

### Migration file rules

- **Never edit existing migration files.** Migration history is append-only — do not modify already-committed migrations (applies to `supabase/migrations/*.sql`, including pgflow-managed files).
- **Create a new migration for every schema change**, named with the implementation date + sequence + description:
  - Naming convention: `YYYYMMDD{seq}_snake_case_description.sql`
  - Examples: `20260423000001_initial.sql`, `20260507000001_episode_status_lifecycle.sql`
- **Timestamp ordering:** The new filename must sort after every migration already on `main` (and typically after the remote tip). Out-of-order versions break `supabase db push` on deploy.
- If `db reset`/`db push` would be affected by the change, make a new migration rather than altering history.

### RLS pattern

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
