# Markdoc: `@hskksk/markdoc-react/server`

Public article bodies use **`createMarkdocConfig` from `@hskksk/markdoc-react/server`** so RSC can run `Markdoc.transform` without importing the client bundle (`"use client"`).

Requires **`@hskksk/markdoc-react` ≥ 0.5.0** (npm).

## Podcaster wiring

- `apps/web/markdoc/config.ts` → `createMarkdocConfig(markdocExtensions)`
- `apps/web/lib/markdoc/prepare.ts` → imports that config for SSG
- `pnpm markdoc:check-config` → golden transform hash

After bumping `@hskksk/markdoc-react`, run `pnpm markdoc:check-config` and update the golden hash if the upstream schema changed intentionally.
