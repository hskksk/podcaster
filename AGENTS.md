# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Podcaster is an AI podcast generator built on Supabase. Article text flows through a pgflow pipeline: `ingest -> craftEpisode(generateScript -> generateAudio -> updateRss)`. Execution is handled by `craft-episode-worker`, and flow definitions are served by `functions/pgflow` ControlPlane. See `CLAUDE.md` and `README.md` for full architecture and command reference. Knowledge files live under `content/`. PKM stack: Capture, Git ingest, Next.js public site, MCP, mem cleanup (`docs/architecture/pkm-next.md`).

### Prerequisites (already installed in the VM environment)

- **Node.js 22** on `PATH` (`apps/web` engines are `22.x`). GitHub Actions workflows use Node 24; do not switch this image to 24 for local typecheck.
- **pnpm 9.14.0** (pinned in `packageManager`, available as `pnpm` in login shells)
- **Docker** (`docker.io`) with the `fuse-overlayfs` storage driver and iptables-legacy
- **Supabase CLI 2.119.0** at `/usr/bin/supabase`

### Starting the development environment

Cloud Agent `start` already brings the stack up. Check `/tmp/cursor/start-user/start-user.log` before starting anything by hand. It:

1. Starts `dockerd` when Docker is not reachable (tmux session `dockerd`, log `/tmp/dockerd.log`)
2. Runs `supabase start` (migrations, Storage, and Edge Functions on port 54331)
3. Runs `TARGET=local pnpm seed:config`
4. Starts `pnpm web:dev` on port 3000 when that port is closed (tmux session `web`, log `/tmp/web-dev.log`)
5. Creates gitignored `.env` and `apps/web/.env.local` with a local `CAPTURE_API_TOKEN` when they are missing

`supabase start` on this CLI serves Edge Functions with `per_worker` reload. Do not also run `pnpm functions:serve` against the same project while that stack is up.

If `start` did not run, from `/workspace`:

```bash
sudo dockerd >/tmp/dockerd.log 2>&1 &
# wait until `docker info` succeeds, then:
supabase start
TARGET=local pnpm seed:config
pnpm web:dev
```

### Key gotchas

- **`supabase status` flag**: Use `-o json` (not `--json`) with this CLI version to get machine-readable output.
- **Edge Functions return immediately**: All worker functions use `EdgeRuntime.waitUntil()` and return `{"ok":true}` right away. Check `processing_logs` via `TARGET=local pnpm cli logs` to see actual results.
- **No test suite**: `pnpm typecheck` is the primary correctness check. There are no unit/integration tests.
- **API keys required for script and audio**: Ingest, the public site, Capture, and `TARGET=local pnpm cli` work without `GEMINI_API_KEY`. `generateScript` and TTS need a real key in `.env`, or the Gemini mock in `README.md` (`pnpm gemini:mock:serve` plus `gemini.api_root` in `podcast_config`).
- **Missing `supabase/seed.sql`**: `supabase/config.toml` lists `./seed.sql`, but that file is not in the repo. `supabase start` prints `no files matched pattern: supabase/seed.sql` and continues. Do not add a seed file unless you mean to change reset behavior.
- **TUI requires TTY**: `pnpm tui` (Ink-based) needs a real terminal with raw mode support. Use `pnpm tui -- --mock` for mock data. It will fail with "Raw mode is not supported" in non-interactive shells.
- **`TARGET=local`**: Set this env var for CLI/TUI commands to connect to the local Supabase stack instead of remote.
- **Never edit existing migrations**: Schema changes require a new `supabase/migrations/` file named `YYYYMMDD{seq}_snake_case_description.sql` (never modify committed migrations). See CLAUDE.md → Database Migrations.
- **Seed config after fresh start**: Run `TARGET=local pnpm seed:config` after `supabase start` or `supabase db reset` to initialize `podcast_config` and upload `cover.png`.

### Commands quick reference

See `CLAUDE.md` for the full list. Key commands:

| Task | Command |
|------|---------|
| Type check | `pnpm typecheck` |
| Type check (Keystatic app) | `pnpm typecheck:web` |
| Keystatic admin | `pnpm web:dev` |
| Start Supabase | `supabase start` |
| Serve functions | `pnpm functions:serve` |
| Reset DB | `pnpm db:reset` |
| Seed config | `TARGET=local pnpm seed:config` |
| CLI (local) | `TARGET=local pnpm cli list articles` |
| TUI (mock) | `pnpm tui -- --mock` |
