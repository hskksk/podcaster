# Capture クライアント（Mac / iPhone）

知識クリップの正本は Git の `content/web-clips/`。サーバ側の入口は **`POST /api/capture`**（TTS / ingest は呼ばない）。実装と env は [apps/web/README.md](../../apps/web/README.md) を参照。

## 共通

- **URL**: `https://<your-vercel-host>/api/capture`
- **認証**: `Authorization: Bearer <CAPTURE_API_TOKEN>`
- **Body（JSON）**:
  - `title`（必須）
  - `content`（必須、Markdown 可）
  - `url`（任意、元ページ URL）
  - `collection`（任意、既定 `web-clips`）
  - `podcast`（任意、既定 `none`）
- **CLI（Mac 開発機）**: ルートの `.env` に `CAPTURE_API_TOKEN` と `CAPTURE_API_URL` を置き `pnpm capture --title "..." --file notes.md`

トークンは **Git への書き込み権**に相当する（公開 repo ならクリップ本文も公開される）。端末に平文で置く前提は「個人端末のみ」と割り切る。

## Mac

| 方法 | 向き |
|------|------|
| `pnpm capture` | ターミナルからファイル／メモを送る |
| Raycast / Shell スクリプト | 選択テキストやクリップボードを `curl` / `pnpm capture` に渡す |
| エージェントスキル | PR で `content/web-clips/` に書く（Capture API は使わない） |

ホーム画面の **Web Clip（Safari → 共有 → ホーム画面に追加）** を使う場合は、Bearer を毎回打たない **簡易 UI** があると楽しい（下記「iPhone と Web Clip」）。API だけを Web Clip の URL にしても、Safari から JSON POST はできない。

## iPhone（Safari から投入）

iOS には Mac のような `curl` が無いので、**ショートカット** を端末上で自作する（iOS 15+ では未署名 `.shortcut` ファイルのインポートは実質不可）。

**手順（アクション単位）**: [ios/README.md](./ios/README.md)

要点:

- Safari **共有シート** から起動
- ページの **タイトル・URL・本文** を辞書に入れ `collection: web-clips`, `podcast: none`
- **URL の内容を取得** で `POST`、ヘッダ `Authorization: Bearer <CAPTURE_API_TOKEN>`
- トークンはショートカット内のテキスト（端末紛失時は Vercel でローテーション）

### Cloudflare Access を使っている場合

Keystatic 全体を Access で守っているなら、Capture だけ **Bypass / Service Token** にする（設計: [pkm-migration.md](../architecture/pkm-migration.md) NFR-04）。ショートカットからは Service Token ヘッダが必要になる。Access を掛けていない Vercel 直叩きなら Bearer だけでよい。

### iPhone と Web Clip（ホーム画面アイコン）

Web Clip は **GET で開く 1 ページ**向き。Bearer 付き API を直接叩く UI が無いと使いにくい。

| やり方 | 説明 |
|--------|------|
| **A. ショートカットをホームに追加** | ショートカットの詳細 → ホーム画面に追加。Safari 共有 → そのショートカット、が最も手堅い |
| **B. 将来 `/clip` ページ（未実装）** | Next.js に最小フォーム（タイトル・メモ・URL）。初回だけトークンを `localStorage` に保存、または Cloudflare Access で人間認証のみ。Mac / iPhone 両方の Web Clip 先にできる |

Mac に置く Web Clip も、**B と同じ `/clip` ページ**を指すと iPhone と操作が揃う。現時点では **A（ショートカット）** か **Mac は `pnpm capture` / Raycast** が API だけで完結する。

## ポッドキャストまで載せたいとき

Capture の既定は `podcast: none`。TTS するには frontmatter を `queued` にする（`PATCH /api/capture` または `pnpm capture --patch ...`）。Git 上の `queued` を ingest するのは Phase 3 の `pnpm ingest:queued` / Actions（[pkm-next.md](../architecture/pkm-next.md) §6）。
