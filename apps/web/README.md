# @podcaster/web

Next.js App Router + Keystatic admin for the Git + Markdoc knowledge layer.

Phase 1: local filesystem for `pnpm web:dev`. **Vercel では GitHub storage**（GitHub API 経由で `content/` に commit）。`articles/` とポッドキャストパイプラインは未変更。

```bash
# from repo root
pnpm web:dev
# Keystatic: http://127.0.0.1:3000/keystatic
```

## Vercel（推奨）

モノレポなので、Vercel の Project Settings → Root Directory を **`apps/web`** にする（Import 画面の Edit でも可）。`rootDirectory` は vercel.json には書けない。

1. GitHub にこのリポジトリを Import するか、`vercel link --repo` してから `vercel deploy`
2. 一度だけ GitHub App を作る（Keystatic のウィザードは **development でしか動かない**）:

```bash
pnpm web:github
# 開く: http://127.0.0.1:3000/keystatic/setup
# /keystatic の「Log in with GitHub」でも同じセットアップに飛ぶ
```

3. 生成された値を Vercel → Project → Settings → Environment Variables に入れる:

   - `KEYSTATIC_GITHUB_CLIENT_ID`
   - `KEYSTATIC_GITHUB_CLIENT_SECRET`
   - `KEYSTATIC_SECRET`
   - `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`

4. GitHub App の Callback URL に  
   `https://<vercel-domain>/api/keystatic/github/oauth/callback` があることを確認
5. Redeploy。`/keystatic` で GitHub ログイン（この repo への write 権限が必要）

Vercel 上では `NEXT_PUBLIC_VERCEL_ENV` があるので storage は自動的に `github` になる。`NODE_ENV` では切り替えない。

任意で `KEYSTATIC_BASIC_AUTH=user:password` を足すと `/keystatic` を二重に守れる。GitHub OAuth の callback は Basic 認証の外。

## ローカル

`NEXT_PUBLIC_KEYSTATIC_STORAGE` 未設定なら `content/docs` と `content/web-clips` に直書き。Next は `apps/web/.env.local` だけを読む。

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm web:dev
```

GitHub App 作成だけするとき:

```bash
pnpm web:github
# http://127.0.0.1:3000/keystatic/setup
```

## 他ホスト

| ホスト | 向き |
|---|---|
| **Vercel** | GitHub storage。Phase 1 の公開先 |
| Netlify | 同様に GitHub storage なら可 |
| Railway | local storage の常駐プロセス向け（`apps/web/Dockerfile`）。必須ではない |
| Supabase | Next.js のホストではない |
