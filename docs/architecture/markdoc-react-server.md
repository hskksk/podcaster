# Markdoc: `@hskksk/markdoc-react/server`

Public article bodies use **`createMarkdocConfig` from `@hskksk/markdoc-react/server`** so RSC can run `Markdoc.transform` without importing the client bundle (`"use client"`).

Requires **`@hskksk/markdoc-react` ≥ 0.5.0** on npm (with `./server` in `exports`).

## Workspace copy (until npm ≥ 0.5.0)

`packages/markdoc-react` is a temporary **0.5.0** snapshot with `src/server.ts`. Remove it once the registry serves ≥ 0.5.0:

1. Set `apps/web` to `"@hskksk/markdoc-react": "^0.5.0"`.
2. Delete `packages/markdoc-react`.
3. `pnpm install` and `pnpm markdoc:check-config`.

Committed `dist/` avoids Vercel production installs needing `tsup` during `prepare`.

## Podcaster wiring

- `apps/web/markdoc/config.ts` → `createMarkdocConfig(markdocExtensions)`
- `apps/web/lib/markdoc/prepare.ts` → imports that config for SSG
- `pnpm markdoc:check-config` → golden transform hash

After bumping `@hskksk/markdoc-react`, run `pnpm markdoc:check-config` and update the golden hash if the upstream schema changed intentionally.
