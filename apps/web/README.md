# @podcaster/web

Next.js App Router + Keystatic admin for the Git + Markdoc knowledge layer.

Phase 4: Next.js が公開サイト（一覧・記事・プレイヤー）。`/keystatic` は非公開。`POST /api/capture` は Git に置くだけ。TTS は呼ばない。

```bash
# from repo root
pnpm web:dev
# Portal:    http://127.0.0.1:3000/
# Podcast:   http://127.0.0.1:3000/podcast
# ふしぎ旅:  http://127.0.0.1:3000/juken
# Keystatic: http://127.0.0.1:3000/keystatic
```

## Vercel（推奨）

モノレポなので、Vercel の Project Settings → Root Directory を **`apps/web`** にする（Import 画面の Edit でも可）。`rootDirectory` は vercel.json には書けない。

公開ページは **ビルド時に静的 HTML を焼く**（`force-static`）。

- `/` は hskksk の入口
- `/podcast` と `/podcast/articles/[slug]` は wiki とポッドキャスト。旧 `/`・`/articles/[slug]`・`/search`・`/web-clips` はここへリダイレクトする
- `/juken` は private **`hskksk/knowledges`** の `content/juken/`

Markdoc 本文は **`pnpm knowledge:checkout`** でビルドマシンに取り込んだ `.knowledge-checkout/` から読む（`apps/web` の **prebuild** が Vercel でもこれを実行）。podcaster リポ内の `content/` は使わない。Keystatic / Capture の commit 先も `hskksk/knowledges`。

記事本文は `@markdoc/next.js`（`mode: "static"`）と同じスキーマ（`apps/web/markdoc/`）でコンパイル。Keystatic の正本は `content/ai-podcast/{entry}/index.mdoc` と `notes/{entry}/index.mdoc`。

### 初回だけ（knowledges 分割後のデプロイ）

1. **Vercel → podcaster → Environment Variables（Build）**: `KNOWLEDGE_GITHUB_REPO=hskksk/knowledges`, `KNOWLEDGE_GITHUB_TOKEN`（knowledges の **read** のみ。clone 用）
2. 同じ画面で **Install Command** がモノレポ用（例: `cd ../.. && pnpm install`）になっていること。Build Command は既定の `pnpm build`（`apps/web`）でよい — prebuild が checkout する
3. **GitHub → Keystatic 用 App** → Repository access に **`hskksk/knowledges`** を追加（以前 podcaster だけなら要変更）
4. **Vercel（Runtime, Production + Preview）**: 既存の `KEYSTATIC_*` に加え、任意で `KEYSTATIC_GITHUB_REPO=hskksk/knowledges`。Capture 用 `CAPTURE_GITHUB_TOKEN` は knowledges への **write**
5. マージ後 Redeploy。ビルドログに `[knowledge] ok CONTENT_ROOT=...` が出れば読み取り OK
6. **knowledges 記事 PR の Vercel プレビュー**（任意）: podcaster Actions に `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`（`apps/web` で `vercel link` 後の `.vercel/project.json`）と `KNOWLEDGES_PR_COMMENT_TOKEN`（knowledges への PR コメント用 PAT）

詳細は [content-platform-split.md](../../docs/architecture/content-platform-split.md)。

音声プレイヤーと記事挿絵（エピソード画像）も **ビルド時** に解決する（SSG）。画像はそのデプロイの `next build` 時点の DB/RSS スナップショット。追従には再デプロイが必要。

1. **推奨**: Vercel の `SUPABASE_PROJECT_REF`（または `NEXT_PUBLIC_SUPABASE_PROJECT_REF`）と `SUPABASE_SERVICE_ROLE_KEY` を **Build** 環境（Production **と Preview**）に含める。
2. **フォールバック**: サービスロールが無くても、project ref さえあれば公開 RSS（`feed.xml`）から記事タイトル → 音声 URL / `itunes:image` を引く。
3. **任意**: リポジトリの `config.toml` に `[podcast] supabase_project_ref = "…"` を書くと env 未設定の CI でも RSS フォールバックが動く。

Runtime だけにキーを置くとプレイヤーとカバーは空の HTML のままデプロイされる。Preview でカバーだけ出ない場合は、Build ログの `[site] image map empty` と RSS に `<itunes:image>` があるかを確認する。

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
   - Vercel の **Preview 環境**にも `NEXT_PUBLIC_SITE_URL` と `KEYSTATIC_*` を入れる（Production のみだと Preview は Keystatic 標準 OAuth になり、Preview ホストが `redirect_uri` になって GitHub が止める）
   - 本番 callback は `code` を Preview の `proxy-return` に転送し、**token exchange は Preview 側**で 1 回だけ（`redirect_uri` は本番 URL）
6. Redeploy。`/keystatic` で GitHub ログイン（この repo への write 権限が必要）

### GitHub が「redirect_uri is not associated…」と止めるとき

GitHub は **authorize リクエストの `redirect_uri` クエリ**が、GitHub App に登録した Callback URL と **1 文字でも違う**とこの画面になる（Preview でログイン開始して callback だけ本番、という構成自体はプロキシ有効時は問題ない）。

1. GitHub App → **User authorization callback URL** が次と **完全一致** か確認:  
   `https://podcaster-pied.vercel.app/api/keystatic/github/oauth/callback`（`NEXT_PUBLIC_SITE_URL` + 上記パス）
2. Preview デプロイで `/keystatic` からログイン → ブラウザが GitHub に飛んだあとの URL 内 `redirect_uri=` をデコードし、登録 URL と同じか確認（Preview ホストが入っていたら **OAuth プロキシが動いていない**）
3. PR #147 相当のコードが Preview にデプロイされているか、`KEYSTATIC_SECRET` / `KEYSTATIC_GITHUB_*` が Preview 環境変数にあるか確認

Vercel 上では `NEXT_PUBLIC_VERCEL_ENV` があるので storage は自動的に `github` になる。`NODE_ENV` では切り替えない。

任意で `KEYSTATIC_BASIC_AUTH=user:password` を足すと `/keystatic` を二重に守れる。GitHub OAuth の callback は Basic 認証の外。`/api/capture` は Basic の外で、`Authorization: Bearer <CAPTURE_API_TOKEN>` だけを見る（Cloudflare Access を掛けるなら Capture だけ Bypass / Service Token）。

## Capture

```bash
# apps/web/.env.local に CAPTURE_API_TOKEN を入れて pnpm web:dev
pnpm capture --title "クリップ" --file notes.md
pnpm capture --title "記事" --file page.md --url https://example.com
# 既定: web-clips + podcast none。Wiki は --collection docs で podcast queued（main マージ後に ingest）
```

Mac / iPhone（Safari・ショートカット・Web Clip）: [docs/guides/capture-clients.md](../../docs/guides/capture-clients.md)

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
