# Markdoc: `@hskksk/markdoc-react/server`

Public article bodies use **`createMarkdocConfig` from `@hskksk/markdoc-react/server`** so RSC can run `Markdoc.transform` without importing the client bundle (`"use client"`).

## Workspace copy (temporary)

`packages/markdoc-react` is a **0.5.0** snapshot that adds `src/server.ts` and the `/server` export. It tracks [hskksk/markdoc-react](https://github.com/hskksk/markdoc-react) branch `feat/server-entry` until that lands on npm.

**`dist/` is committed** so Vercel’s production `pnpm install` (no devDependencies) does not need `tsup` during `prepare`. `scripts/ensure-dist.mjs` skips the build when `dist/` is present.

After **0.5.0** is published to npm:

1. Set `apps/web` to `"@hskksk/markdoc-react": "^0.5.0"`.
2. Remove `packages/markdoc-react` from this monorepo.
3. Run `pnpm install` and `pnpm markdoc:check-config`.

## Podcaster wiring

- `apps/web/markdoc/config.ts` → `createMarkdocConfig(markdocExtensions)`
- `apps/web/lib/markdoc/prepare.ts` → imports that config for SSG
- `pnpm markdoc:check-config` → golden transform hash
