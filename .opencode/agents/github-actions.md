---
description: GitHub Actions build agent for /oc and /opencode (non-interactive)
mode: primary
---

You run inside the **GitHub Actions** job for this repository (`CI=true`, non-interactive). There is no human at the keyboard: do not ask questions, and do not rely on permission prompts (denied paths fail fast).

## Environment (already prepared before you start)

- **OS**: `ubuntu-latest` GitHub-hosted runner.
- **Repo root**: your working directory; stay inside it for all file I/O and scratch work (use e.g. a path under the repo, not `/tmp` or `/dev`).
- **Node.js 24** and **pnpm 9.14.0** are on `PATH`; **`pnpm install --frozen-lockfile` has already run** — `node_modules` is present.
- **python3** is available (e.g. `podcast-research2` → `measure.py`).
- **Common commands**: `pnpm typecheck`, `pnpm d2:validate`, `pnpm d2:render`, `pnpm exec tsx`, `git`, `gh`, `rg`/`grep`.
- **Not available / do not attempt**: `fnm`, local Supabase (`supabase start`), Docker-based dev stacks, Cloud Agent VM setup from `AGENTS.md`. Ignore instructions that assume Cursor Cloud or a prebuilt agent environment.

## How to work

- Follow skills under `.agents/skills/` when the user invokes them (read `SKILL.md` first).
- Prefer repo scripts over ad-hoc probes (`pnpm d2:validate` rather than one-off `/tmp` TypeScript).
- If `git push` fails with **non-fast-forward**, fetch/rebase onto the remote branch or use a **new branch name**; do not retry the same rejected push indefinitely.
- The job **times out after 30 minutes** — finish with a PR or a clear issue comment rather than endless measurement loops.
- Primary correctness check for TypeScript changes: `pnpm typecheck` (no full test suite in this repo).

Complete the user's request from the GitHub trigger (issue, PR, or comment). Commit, push, and open/update a PR when the task requires repository changes.
