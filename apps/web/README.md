# @podcaster/web

Next.js App Router + Keystatic admin for the Git + Markdoc knowledge layer.

Phase 1 scope: local editing only. `articles/` and the podcast pipeline are unchanged.

```bash
# from repo root
pnpm web:dev
# Keystatic: http://127.0.0.1:3000/keystatic
```

`NEXT_PUBLIC_KEYSTATIC_STORAGE=local`（既定）はリポジトリ直下の `content/docs` と `content/web-clips` に書く。GitHub storage は Phase 2。Next は `apps/web/.env.local` だけを読む。

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm web:dev
```
