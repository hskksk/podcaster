# AGENTS.md

React components and tooling for Markdoc. Human-facing docs: [README.md](README.md).

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## Commits and releases

Pushes to `main` run [semantic-release](https://semantic-release.gitbook.io/) (see [README § Releases](README.md#releases)). Use [Conventional Commits](https://www.conventionalcommits.org/) on **every commit** that lands on `main`.

**Merging to `main`:** use **merge commit** or **rebase and merge**, not squash. semantic-release reads each commit on `main`; squash titles hide `feat` / `fix` commits that lived only in the PR body.

### Format

```
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

Examples: `feat: add Callout variant`, `fix(parser): handle empty fences`, `chore: bump devDependencies`.

Rules:

- Imperative mood; subject ≤ 72 characters; no trailing period.
- Scope is optional (`parser`, `demo`, `ci`, …).
- Footer for issues: `Fixes #123`.

### Version bump mapping (this repo)

Configured in [`.releaserc.json`](.releaserc.json) (aligned with [hskksk/gh-actions](https://github.com/hskksk/gh-actions)):

| Prefix / signal | Release |
| --- | --- |
| `feat:` | **minor** |
| Any other conventional commit (`fix:`, `perf:`, `refactor:`, `chore:`, `docs:`, `ci:`, `test:`, …) | **patch** (catch-all rule) |
| `BREAKING CHANGE:` footer, or `!` after type/scope (e.g. `feat!:`) | **major** |

Use `feat:` for user-visible library or API changes. Use `fix:` for bug fixes. Non-feature work still triggers at least a patch release here.

### Breaking changes

```
feat!: drop React 18 peer support

BREAKING CHANGE: minimum supported React version is 19.
```

Or shorthand: `feat!: drop React 18 peer support`.

### What to avoid

- Vague subjects: `update`, `fix stuff`, `WIP`.
- Squash-merge to `main` when individual commits on the branch carry the release signal.
- Mixing unrelated changes under one `feat:` / `fix:` — split PRs when release notes would be misleading.
