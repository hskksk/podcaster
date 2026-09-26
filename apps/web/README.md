# @podcaster/web

Next.js App Router + Keystatic admin for the Git + Markdoc knowledge layer.

Phase 4: Next.js が公開サイト（一覧・記事・プレイヤー）。`/keystatic` は非公開。`POST /api/capture` は Git に置くだけ。TTS は呼ばない。

```bash
# from repo root
pnpm web:dev
# Public site: http://127.0.0.1:3000/
# Keystatic:   http://127.0.0.1:3000/keystatic
```

## Vercel（推奨）

モノレポなので、Vercel の Project Settings → Root Directory を **`apps/web`** にする（Import 画面の Edit でも可）。`rootDirectory` は vercel.json には書けない。

公開ページ（`/` と `/articles/[slug]`）は GitHub Pages の `scripts/build-web.ts` と同じく **ビルド時に静的 HTML を焼く**（`force-static`）。`content/docs` は Vercel の git clone に含まれているので `next build` から読める。サーバーレス関数に `content/` を同梱しない。Keystatic は GitHub storage のまま（管理画面にドキュメントがあっても、公開面はデプロイ時の Git スナップショット）。

記事本文は `@markdoc/next.js`（`mode: "static"`）と同じスキーマ（`apps/web/markdoc/`）で `@markdoc/markdoc` がコンパイルする。Keystatic の正本は `content/docs/{entry}/index.mdoc` なので、プラグインが要求する `app/**/*.mdoc` へは置かない（slug は `legacyFilename`、ディレクトリ名ではない）。

音声プレイヤーも **ビルド時** に解決する（SSG）。

1. **推奨**: Vercel の `SUPABASE_PROJECT_REF`（または `NEXT_PUBLIC_SUPABASE_PROJECT_REF`）と `SUPABASE_SERVICE_ROLE_KEY` を **Build** 環境に含める。
2. **フォールバック**: サービスロールが無くても、project ref さえあれば公開 RSS（`feed.xml`）から記事タイトル → 音声 URL を引く。
3. **任意**: リポジトリの `config.toml` に `[podcast] supabase_project_ref = "…"` を書くと env 未設定の CI でも RSS フォールバックが動く。

Runtime だけにキーを置くとプレイヤーは空の HTML のままデプロイされる。

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
   - `CAPTURE_API_TOKEN`（クリップ用 Bearer。ingest / Gemini には届かない）
   - `CAPTURE_GITHUB_TOKEN` または `GITHUB_TOKEN`（Contents: write。Keystatic OAuth とは別）

4. GitHub App の Callback URL には **本番ドメインだけ** を登録する:  
   `https://<production-domain>/api/keystatic/github/oauth/callback`  
   （Preview ごとに URL を足す必要はない — 下記プロキシを有効にする場合）
5. **Preview でも `/keystatic` にログインしたい場合**（Auth.js の `redirectProxyUrl` と同じ考え方）:
   - Production / Preview / Development すべてに `NEXT_PUBLIC_SITE_URL=https://<production-domain>`（末尾スラッシュなし。公開サイト用と同じ値）  
     または `KEYSTATIC_OAUTH_PROXY_URL=https://<production-domain>/api/keystatic/github/oauth/callback`
   - `KEYSTATIC_SECRET` は Production と Preview で **同一**（Preview だけ別 secret にしない）
6. Redeploy。`/keystatic` で GitHub ログイン（この repo への write 権限が必要）

Vercel 上では `NEXT_PUBLIC_VERCEL_ENV` があるので storage は自動的に `github` になる。`NODE_ENV` では切り替えない。

任意で `KEYSTATIC_BASIC_AUTH=user:password` を足すと `/keystatic` を二重に守れる。GitHub OAuth の callback は Basic 認証の外。`/api/capture` は Basic の外で、`Authorization: Bearer <CAPTURE_API_TOKEN>` だけを見る（Cloudflare Access を掛けるなら Capture だけ Bypass / Service Token）。

## Capture

```bash
# apps/web/.env.local に CAPTURE_API_TOKEN を入れて pnpm web:dev
pnpm capture --title "クリップ" --file notes.md
pnpm capture --title "記事" --file page.md --url https://example.com
# 既定: content/web-clips/{YYYY-MM-DD}-{slug}/index.mdoc 、podcast: none
```

本番は Octokit で `main` に Direct Commit。GitHub API が 2 秒を超えると `202` + `retryable: true`。同じ body を再送すると既存 SHA を返す。

### ブランチ保護

Capture は `main` 直 commit。保護を掛けるなら次のどちらか:

1. **bypass allowlist** に Capture 用 GitHub App または fine-grained PAT のアクターを入れる（推奨）
2. `main` に保護を掛けない（現状どおり）

Rulesets で「restrict updates」だけを使うと Octokit の Direct Commit は 403 になる。PR 必須ルールは Capture と両立しないので、必須レビューは `content/` 以外、または上記 bypass にする。

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
| **Vercel** | 公開サイト + GitHub storage。Phase 4 の公開先 |
| Netlify | 同様に GitHub storage なら可 |
| Railway | local storage の常駐プロセス向け（`apps/web/Dockerfile`）。必須ではない |
| Supabase | Next.js のホストではない |
