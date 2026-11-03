# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Podcaster is an AI podcast generator on Supabase. Article text flows through the **events + jobs** pipeline: `ingest` appends domain events → `domain-subscriber` (ProductionPolicy) enqueues `jobs.*` → `job-worker` (`runJob`) → publish / RSS. See `CLAUDE.md` and `docs/architecture/podcast-domain-model-migration.md`. Knowledge files live under `content/`.

### Documentation maintenance

- Operational documentation and agent skills describe the **current** behavior and rules. When changing them, replace obsolete guidance instead of appending a chronological account of the change.
- Do not add revision histories, session narratives, “before/after” timelines, experiment diaries, or notes about what an agent just changed unless the user explicitly asks for that record.
- Git history and pull requests are the default record of change. If a design rationale must remain discoverable, put the current decision and its reason in a dedicated design document; do not repeat the history in every operational file.
- Keep one authoritative location for each rule and link to it from other files. Retain only the smallest example needed to apply the rule.
- Generated reports under `content/` must stand on their own and must not mention the skill, prompt, agent session, or revision process that produced them.

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

### Pull requests and commits

CI の **`lint-pr`** ワークフロー（commitlint + semantic-pull-request）が、**PR タイトルとブランチ上の全コミット**を [Conventional Commits](https://www.conventionalcommits.org/) 形式で検証する。どちらかが外れると PR の CI が落ちる。

- **形式**: `type(optional-scope): subject`（例: `feat(web): add capture patch`、`docs(agents): note conventional commits`、`chore: bump dependency`）
- **type**（よく使うもの）: `feat`, `fix`, `docs`, `refactor`, `chore`, `ci`, `build`, `test`, `perf`, `style`, `revert`
- **PR タイトル**もコミットと同じ規約にする（スカッシュマージ後の履歴になる）
- **最終メッセージの 1 行目が PR タイトルとして使われる**（インフラが PR 作成時に採用する）。1 行目を必ず `type(scope): subject` にし、報告本文は 2 行目以降に書く。日本語の報告文を 1 行目に置くと `semantic-pull-request` が失敗する
- コミット本文は任意。subject は命令形・小文字始まりが無難

**main の取り込み（マージコミット禁止）:** `lint-pr` は **ブランチ上の全コミット**を検証する。`git merge origin/main -m "merge main (...)"` のような説明用メッセージは Conventional Commits ではないので **commitlint が必ず落ちる**。エージェントは次のどちらかで main を取り込む（マージコミットを PR に載せない）。

1. **rebase（推奨）:** `git fetch origin main && git rebase origin/main` — コンフリクト解消後、必要なら `git rebase --continue`。各コミットの 1 行目が規約どおりか確認する。
2. **1 コミットにまとめる:** 作業ツリーを残したまま `git fetch origin main && git reset --soft origin/main` → 変更を 1 つの `type(scope): subject` で commit → push（force-with-lease 可）。

どうしても merge コミットが履歴に残る場合のみ、メッセージの 1 行目自体を規約形式にする（例: `chore: merge main into cursor/foo-bf24`）。`merge main` だけの subject は使わない。

### Key gotchas

- **`supabase status` flag**: Use `-o json` (not `--json`) with this CLI version to get machine-readable output.
- **Edge Functions return immediately**: All worker functions use `EdgeRuntime.waitUntil()` and return `{"ok":true}` right away. Check `processing_logs` via `TARGET=local pnpm cli logs` to see actual results.
- **No test suite**: `pnpm typecheck` is the primary correctness check. There are no unit/integration tests.
- **API keys required for full pipeline**: `GEMINI_API_KEY` must be in `.env` for pgflow stages to succeed. Without it, `generateScript` fails.
- **TUI requires TTY**: `pnpm tui` (Ink-based) needs a real terminal with raw mode support. Use `pnpm tui -- --mock` for mock data. It will fail with "Raw mode is not supported" in non-interactive shells.
- **`TARGET=local`**: Set this env var for CLI/TUI commands to connect to the local Supabase stack instead of remote.
- **Never edit existing migrations**: Schema changes require a new `supabase/migrations/` file named `YYYYMMDD{seq}_snake_case_description.sql` (never modify committed migrations). See CLAUDE.md → Database Migrations.
- **Migration timestamps**: New files must sort **after** the latest migration already on `main` (check `ls supabase/migrations | tail`). Do not add a version earlier than one already merged or applied on remote — `supabase db push` will fail without `--include-all`.
- **Seed config after fresh start**: Run `TARGET=local pnpm seed:config` after `supabase start` or `supabase db reset` to initialize `podcast_config` and upload `cover.png`.
- **PostgREST `jobs` / `podcast` schemas**: Local API exposes them via `supabase/config.toml` `[api].schemas`. After changing that file, run `supabase stop && supabase start`. Remote projects must add the same schemas under Dashboard → API → Exposed schemas.
- **Gemini mock from Edge Functions**: In `config.toml`, set `[gemini] api_root = "http://host.docker.internal:8099"` (not `127.0.0.1`) before `TARGET=local pnpm seed:config`. Edge runs in Docker and cannot reach the host loopback.
- **`external-operation-poller` curl returns `name resolution failed`**: Kong could not reach the function worker — restart `pnpm functions:serve:mock` after pulling new functions. Verify with `curl -s http://127.0.0.1:54331/functions/v1/external-operation-poller` (GET → `{"ok":true,...}`). To poll batches locally, use `pnpm poll:external-ops` (SQL → Kong inside Docker) instead of curling from the host.

### Production pipeline (post Phase 6)

Production runs **`pipeline.mode=events` only**. Ingest appends domain events; `domain-subscriber` enqueues jobs; `job-worker` runs `runJob`. CLI/TUI/web read **`podcast.*_overview`** and **`jobs.attempt_log`**. Legacy pipeline tables are dropped in a **dedicated migration PR** (after soak; use DB backups for history). Dashboard **Exposed schemas** must include **`jobs`** and **`podcast`**.

**Cutover runbook (already on events):** `TARGET=remote pnpm events:reconcile`, `pnpm pipeline:status`, smoke ingest, monitor `event_subscription_failures`. `pipeline:switch legacy` is removed.

**Requeue:** `pnpm cli requeue …` appends `ProductionRequested` or calls `publish`.

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
