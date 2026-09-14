# @podcaster/web

Next.js App Router + Keystatic admin for the Git + Markdoc knowledge layer.

Phase 1 scope: local editing by default. `articles/` and the podcast pipeline are unchanged.

```bash
# from repo root
pnpm web:dev
# Keystatic: http://127.0.0.1:3000/keystatic
```

`NEXT_PUBLIC_KEYSTATIC_STORAGE=local`（既定）はリポジトリ直下の `content/docs` と `content/web-clips` に書く。Next は `apps/web/.env.local` だけを読む。

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm web:dev
```

## リモートで見る

Keystatic の Admin UI は Node.js の API ルートが必要なので、静的ホスト（GitHub Pages）では動かない。

| ホスト | 向き | 理由 |
|---|---|---|
| **Railway** | 今の local storage をそのまま見せる | 常駐プロセス + リポジトリ全体をコンテナに載せられる。`content/` を読める |
| Vercel / Netlify | GitHub storage なら可 | サーバレスの FS は読み取り専用・揮発。local の保存が残らない。GitHub App OAuth が先に必要 |
| Supabase | 不向き | Next.js のホストではない（DB / Edge Functions / Storage 用） |

Vercel 自体が難しいというより、**今の Phase 1（local storage）とサーバレスが合わない**。GitHub App を作って `NEXT_PUBLIC_KEYSTATIC_STORAGE=github` にすれば Vercel は本命になる。その手順は下の「GitHub storage」を参照。

### Railway（推奨・このリポジトリの設定済み）

ルートの `railway.json` と `apps/web/Dockerfile` で、リポジトリルートをコンテキストにした standalone ビルドを行う。公開デプロイは一旦停止済み。再開するときは専用プロジェクトを作るか、既存プロジェクトに `keystatic` サービスを足す。

```bash
# CLI がリンク済みなら
railway up --service keystatic --detach -m "Deploy Keystatic admin"
railway domain --service keystatic --json
```

任意で `KEYSTATIC_BASIC_AUTH=user:password` をサービス変数に置くと `/keystatic` を Basic 認証で守る。

`NEXT_PUBLIC_*` はビルド時に埋め込まれる。GitHub storage に切り替えるときは変数を変えてから再ビルドする。

### Vercel（GitHub storage 向け）

1. ローカルで GitHub App を作る（次節）
2. Vercel で Import。Root Directory は **空のまま（リポジトリルート）** にせず、`apps/web` を Root Directory にする
3. Include files outside the Root Directory をオン（pnpm workspace）
4. Environment Variables:
   - `NEXT_PUBLIC_KEYSTATIC_STORAGE=github`
   - `KEYSTATIC_GITHUB_CLIENT_ID` / `KEYSTATIC_GITHUB_CLIENT_SECRET` / `KEYSTATIC_SECRET`
   - `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`
5. GitHub App の Callback URL に `https://<vercel-domain>/api/keystatic/github/oauth/callback` を足す

Root Directory を `apps/web` にした local storage では `content/` が関数バンドルに入らず、保存も残らない。

### GitHub storage

公式: [GitHub mode](https://keystatic.com/docs/github-mode)

```bash
# apps/web/.env.local
NEXT_PUBLIC_KEYSTATIC_STORAGE=github
```

`pnpm web:dev` で `/keystatic` を開き、画面の指示で GitHub App を作成する。生成された env をホストへコピーする。リポジトリへの write 権限がある GitHub ユーザーだけが Admin UI に入れる。
