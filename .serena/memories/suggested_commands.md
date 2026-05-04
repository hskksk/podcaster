# Suggested commands (Darwin)
## Basic project setup/dev
- `pnpm install`
- `cp .env.example .env.local`
- `supabase start`
- `supabase db reset`
- `pnpm seed:config`
- `pnpm functions:serve`

## Tests/checks and utility
- `pnpm typecheck`
- `pnpm test:post` (local article ingestion test)
- `TARGET=remote pnpm test:post:remote`
- `pnpm cli <subcommand>` (pipeline status/tools)
- `pnpm tui` (terminal UI)

## Deployment/ops
- `pnpm deploy`
- `pnpm setup:gh-secrets`

## Common shell/git
- `ls`, `cd`, `pwd`, `rg <pattern>`
- `git status`, `git diff`, `git log --oneline -n 10`