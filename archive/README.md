# Archived GitHub Pages builders (Phase 4)

The public site is Next.js in `apps/web` (`/` and `/articles/[slug]`).

- `web/template.html` → `archive/web/template.html`
- `scripts/build-web.ts` → `archive/scripts/build-web.ts`

Do not call these from CI. `pnpm web:build` now writes redirect stubs for
`https://hskksk.github.io/podcaster/articles/{slug}.html`.
