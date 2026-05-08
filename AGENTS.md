# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Podcaster is an AI podcast generator built on Supabase. Article text flows through a pgflow pipeline: `ingest -> craftEpisode(generateScript -> generateAudio -> updateRss)`. Execution is handled by `craft-episode-worker`, and flow definitions are served by `functions/pgflow` ControlPlane. See `CLAUDE.md` and `README.md` for full architecture and command reference.

### Prerequisites (already installed in the VM environment)

- **Node.js 24** via fnm (`eval "$(fnm env --shell bash)"` to activate)
- **pnpm 9.14.0** (pinned in `packageManager`)
- **Docker** with fuse-overlayfs storage driver (for Supabase local stack)
- **Supabase CLI** (`supabase` binary at `/usr/local/bin/supabase`)

### Starting the development environment

```bash
# 1. Activate Node.js (required in every new shell)
eval "$(fnm env --shell bash)"

# 2. Start Docker daemon (if not running)
dockerd &>/tmp/dockerd.log &
sleep 3

# 3. Start the Supabase local stack (pulls Docker images on first run, ~2 min)
supabase start

# 4. Serve Edge Functions (in a separate terminal/tmux pane)
pnpm functions:serve
```

### Key gotchas

- **`supabase status` flag**: Use `-o json` (not `--json`) with this CLI version to get machine-readable output.
- **Edge Functions return immediately**: All worker functions use `EdgeRuntime.waitUntil()` and return `{"ok":true}` right away. Check `processing_logs` via `TARGET=local pnpm cli logs` to see actual results.
- **No test suite**: `pnpm typecheck` is the primary correctness check. There are no unit/integration tests.
- **API keys required for full pipeline**: `GEMINI_API_KEY` and `MEM_API_KEY` must be in `.env` for `ingest` / pgflow stages to succeed. Without them, ingest returns errors and `generateScript` stage fails.
- **TUI requires TTY**: `pnpm tui` (Ink-based) needs a real terminal with raw mode support. Use `pnpm tui -- --mock` for mock data. It will fail with "Raw mode is not supported" in non-interactive shells.
- **`TARGET=local`**: Set this env var for CLI/TUI commands to connect to the local Supabase stack instead of remote.
- **Seed config after fresh start**: Run `TARGET=local pnpm seed:config` after `supabase start` or `supabase db reset` to initialize `podcast_config` and upload `cover.png`.

### Commands quick reference

See `CLAUDE.md` for the full list. Key commands:

| Task | Command |
|------|---------|
| Type check | `pnpm typecheck` |
| Start Supabase | `supabase start` |
| Serve functions | `pnpm functions:serve` |
| Reset DB | `pnpm db:reset` |
| Seed config | `TARGET=local pnpm seed:config` |
| CLI (local) | `TARGET=local pnpm cli list articles` |
| TUI (mock) | `pnpm tui -- --mock` |
