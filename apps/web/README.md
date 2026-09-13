# @podcaster/web

Next.js App Router + Keystatic admin for the Git + Markdoc knowledge layer.

Phase 1 scope: local editing only. `articles/` and the podcast pipeline are unchanged.

```bash
# from repo root
pnpm web:dev
# Keystatic: http://127.0.0.1:3000/keystatic
```

`KEYSTATIC_STORAGE=local` / `NEXT_PUBLIC_KEYSTATIC_STORAGE=local` (default) writes to `content/docs` and `content/web-clips` at the repository root. GitHub storage is wired but unused until Phase 2.
