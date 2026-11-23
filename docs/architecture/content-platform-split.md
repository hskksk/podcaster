# コンテンツ / プラットフォーム分離設計

> 日付: 2026-11-21  
> 前提: [pkm-migration.md](./pkm-migration.md) の「知識の正 = Git」「配信の正 = Supabase」は維持する。  
> 変更点: **GitHub 上の知識ファイルは private リポに集約**し、**platform は public のまま**運用する。

この文書は移行後の **ディレクトリ構成** と **現行リポからの持ち込み元** を定義する。実装順・PR 境界は [pkm-next.md](./pkm-next.md) を更新して追随する。

---

## 1. リポジトリの役割

| リポジトリ | 可視性 | 役割 |
|------------|--------|------|
| **`hskksk/podcaster`** | **public** | 配信基盤（Supabase / Edge / pgflow）、公開サイト用 Next.js、MCP / ops、CLI・TUI、型・マイグレーション、**公開用の設計ドキュメント** |
| **`hskksk/knowledges`**（移行中は **`hskksk/blog`**） | **private** | 知識の **正本**（Markdoc）、Keystatic が commit する先、ポッドキャスト `podcast: queued` の検知、`ingest:queued` の書き戻し、（将来）Zenn / note 向け export |

命名: GitHub リネームは後回し。**いまは `hskksk/blog` で `content/` + `notes/` を整備**し、完了後に `knowledges` へ改名する。

### 1.1 変えない原則

- 配信パイプライン（ingest → domain events → jobs → RSS）は **platform + Supabase** のまま
- ingest は **本文を POST** するだけ（Edge は Git を読まない）
- **notes の web-clips → content の ai-podcast**（または blog）への昇格は **copy + `promotedTo`**（`git mv` で履歴を切らない）
- 公開サイトに載せる本文は **ビルド時にマークダウンを読む**（Vercel は platform デプロイ、本文は private をビルド時に取得）
- **`content/`** = 公開・配信に載せうる完成物（サイト・ポッドキャスト・juken・ブログ）  
- **`notes/`** = 非公開の下書き・クリップ・調査メモ（昇格するまで ingest / 公開一覧に出さない）

---

## 2. private: `hskksk/knowledge` のディレクトリ構成（目標）

`content/` は **種類ごとの階層**に分ける。執筆中・クリップは **`notes/`**（旧案の `draft/` は使わない）。

```text
knowledge/                          # private
├── content/                        # 公開・配信に載せうる正本
│   ├── ai-podcast/                 # AI ポッドキャスト用 wiki 記事（旧 content/docs）
│   │   └── {slug}/
│   │       ├── index.mdoc
│   │       ├── treemap.yml         # 任意
│   │       └── section-visuals.yml # 任意
│   ├── juken/                      # 中学受験・ふしぎ旅（旧 chugaku-juken/）
│   │   └── sapix/grade5-japanese-history/weeks/…
│   ├── blog/                       # 自分で書いたブログ（Zenn / note 配信メタ付き・新設）
│   │   └── {slug}/
│   │       ├── index.mdoc
│   │       └── *.png
│   └── keystatic-templates/        # Keystatic 新規エントリ用テンプレ
│       ├── new-ai-podcast-article/
│       ├── new-web-clip/
│       └── new-blog/
├── notes/                          # 非公開メモ（**フラット**。サブフォルダなし）
│   └── {slug}/
│       ├── index.mdoc              # 既定。単体 .md も可
│       └── …                       # 昇格前の添付（input 画像など）
├── .agents/skills/                 # 執筆・調査スキル
├── .github/workflows/
│   ├── ingest-queued.yml
│   └── distribute-blog.yml         # 将来
├── scripts/
├── package.json
└── README.md
```

### 2.1 パスと platform の対応（実装時の定数）

| 論理名 | knowledge 上のパス | 公開サイト（想定） | ingest `podcast: queued` |
|--------|-------------------|--------------------|---------------------------|
| AI podcast 記事 | `content/ai-podcast/{slug}/index.mdoc` | `/podcast/articles/[slug]` | ✅ 対象 |
| Juken 物語 | `content/juken/**.mdoc` | `/juken` | ❌ 対象外 |
| Blog | `content/blog/{slug}/index.mdoc` | `/blog`（新設）など | 任意（frontmatter） |
| Web clip | `notes/{slug}/index.mdoc`（`kind: web-clip`） | `/podcast/web-clips`（ゲート付き）または非掲載 | ❌ 既定 none |

既存 DB の `content_path` は移行 PR で **`content/docs/…` → `content/ai-podcast/…`**、**`content/web-clips/…` → `notes/web-clips/…`** に一括リマップする（または ingest_meta で両方を OR）。新規は新パスのみ。

### 2.2 Keystatic コレクション（案）

| コレクション | `path` | 備考 |
|--------------|--------|------|
| AI Podcast Articles | `content/ai-podcast/*/` | 旧 `docs` |
| Notes（Web clip 含む） | `notes/*/` | `kind` + `tags` で分類。旧 `content/web-clips` も同階層 |
| Blog Posts | `content/blog/*/` | 新設 |

`kind` 列挙例: `idea` \| `memo` \| `web-clip`。Capture 既定は `kind: web-clip`。

### 2.3 ライフサイクル（更新）

```text
Capture / スキル
    → notes/web-clips (podcast: none)
            │ 整理・昇格（copy）
            ▼
    content/ai-podcast  or  content/blog (podcast: none | queued)
            │ 明示 queued
            ▼
    ingest → Supabase → podcast: published
```

- `notes/knowledges` から調査レポートを出すとき: **`content/ai-podcast` に copy**（`promotedTo` は clips 側と同様のメタでよい）
- `notes/ideas` / `notes/memos` からブログを出すとき: **`content/blog` に copy**

### 2.4 `content/blog` の frontmatter（設計メモ）

```yaml
---
title: …
publishedAt: 2025-12-14
podcast: none
channels:
  site: true
  zenn: true
  note: false
distribution:
  site: live
  zenn: queued | published | skipped
  note: skipped
externalUrl:
  zenn: https://zenn.dev/…
  note: https://note.com/…
sourcePath: notes/memos/…   # 任意: 昇格元
---
```

---

## 3. public: `hskksk/podcaster` のディレクトリ構成（目標）

**public リポの Git 履歴に private への参照を残さない。** `content/`・`chugaku-juken/` は podcaster から削除し、本文は **ビルド／開発時に private を clone した作業コピー**だけを読む（submodule は使わない）。

```text
podcaster/                          # public（private への .gitmodules なし）
├── apps/web/                       # SSG: 作業コピー配下の content/ai-podcast 等
├── scripts/
│   └── checkout-knowledge.ts       # KNOWLEDGE_* で shallow sparse clone
├── .gitignore                      # .knowledge-checkout/ など
├── knowledge.lock.json             # 任意: 本番ビルド用の固定 SHA（公開してよいメタのみ）
└── …                               # supabase, docs, packages（従来どおり）
```

### 3.1 なぜ submodule にしないか

| submodule | シークレット付き checkout（採用） |
|-----------|-----------------------------------|
| `.gitmodules` に private URL が載る | public 側は **URL も SHA もコミットしない**（env + 任意 lock ファイル） |
| fork / clone した第三者が private 参照にぶつかる | clone だけなら public 単体でビルド可能（中身空 or fixture） |
| platform の PR と knowledge の SHA が連動 PR になる | デプロイは **Vercel の Secrets** と lock で再現 |

**Keystatic / Capture** はもともと GitHub API で private に commit するので、**読む側も「ローカル作業ツリー」or API** で足り、submodule は必須ではない。

### 3.2 Knowledge checkout（ビルド時・ローカル）

```text
deploy / vercel-build / pnpm web:dev（初回）
    │
    ├─ KNOWLEDGE_GITHUB_REPO=hskksk/blog
    ├─ KNOWLEDGE_GITHUB_TOKEN=…（read 専用）
    ├─ KNOWLEDGE_GIT_REF=main | <sha>      # 未設定時 knowledge.lock.json → main
    ▼
pnpm knowledge:checkout   # 既定: sparse + shallow + blob:none
    ▼
CONTENT_ROOT=.knowledge-checkout
```

**転送量を抑える既定**（`scripts/checkout-knowledge.ts`）:

| 手段 | 効果 |
|------|------|
| `--depth 1`（`KNOWLEDGE_DEPTH`） | 履歴なし。1 commit 分だけ |
| `--filter=blob:none`（`KNOWLEDGE_FILTER_BLOBS=0` で OFF） | ツリー先まで blob を遅延取得し、sparse 外はほぼ取らない |
| **sparse-checkout** | 既定は `content`, `styles`, `notes`。`.agents/`, `.github/`, 大きな `scripts/` は取得しない |
| `KNOWLEDGE_INCLUDE_NOTES=0` | 公開ビルドだけなら `notes/` ごとスキップ（web-clips ルートを出さないとき） |
| `KNOWLEDGE_SPARSE_PATHS` | カンマ区切りで上書き（例: `content/ai-podcast,content/juken` のみ） |
| `KNOWLEDGE_CHECKOUT_METHOD=archive` | Git なし tarball 1 本（sparse 不可・リポ全体）。比較用 |

ブランチ先頭ビルドは **sparse-shallow + blob:none** が一般に最小。SHA 固定ビルドも `fetch --depth 1 origin <sha>` で同様。

| 変数 | 用途 |
|------|------|
| `KNOWLEDGE_GITHUB_REPO` | `owner/repo`（private 正本） |
| `KNOWLEDGE_GITHUB_TOKEN` | clone 用。Vercel **Build**、GitHub Actions、ローカル `.env` |
| `KNOWLEDGE_GIT_REF` | branch / tag / SHA。未設定時 `knowledge.lock.json` または `main` |
| `KNOWLEDGE_DEPTH` | 既定 `1` |
| `KNOWLEDGE_FILTER_BLOBS` | 既定 ON（`0` で無効） |
| `KNOWLEDGE_CHECKOUT_METHOD` | `sparse-shallow`（既定）\| `archive` |
| `KNOWLEDGE_CHECKOUT_SKIP` | `1` でスキップ（fork CI 等） |
| `CONTENT_ROOT` | 既定: `$REPO_ROOT/.knowledge-checkout` |
| `KEYSTATIC_GITHUB_REPO` | Keystatic の commit 先（同上 `owner/repo`） |

読み取りパス（`CONTENT_ROOT` 基準）:

- ポッドキャスト wiki: `content/ai-podcast`
- Juken: `content/juken`
- Notes / web-clips: `notes/`（`kind === web-clip` でフィルタ）
- Blog: `content/blog`

**`knowledge.lock.json`（任意）**: `{ "repo": "hskksk/blog", "sha": "abc123…" }` を public にコミットしてよい。中身はコミット ID のみ。更新は knowledge マージ後に bot または手動 PR。トークンは載せない。

### 3.3 Vercel

1. **Build command の先頭**: `pnpm knowledge:checkout`（または `vercel-build` 内で実行）
2. **Environment Variables（Build）**: `KNOWLEDGE_GITHUB_REPO`, `KNOWLEDGE_GITHUB_TOKEN`, 任意 `KNOWLEDGE_GIT_REF`
3. **Submodule は無効のまま**

Keystatic の runtime commit は引き続き **private リポ**へ。公開 HTML は **そのビルドで clone したスナップショット**（SSG）。

### 3.4 ローカル開発

```bash
git clone git@github.com:hskksk/podcaster.git
# .env に KNOWLEDGE_* を置く（README / .env.example に名前だけ記載）
pnpm knowledge:checkout   # 実装後
pnpm web:dev
```

トークンなしの OSS 参加者は checkout をスキップし、空の fixture で UI 開発する（文書化のみ）。

### 3.5 本番を knowledge 更新に追随させる

| 方式 | 内容 |
|------|------|
| **A. lock ファイル** | knowledge `main` の SHA を `knowledge.lock.json` に書く PR → podcaster マージ → Vercel 再デプロイ |
| **B. Deploy Hook（採用）** | knowledges `dispatch-podcaster-deploy.yml` が podcaster `repository_dispatch` → `knowledges-vercel-deploy.yml` → Hook（ingest とは別 workflow） |
| **C. 定期ビルド** | Vercel cron（運用簡単だが SHA 追跡が曖昧） |

推奨: **本番は A（再現性）**、プレビューは **B または main 追従**。

---

## 4. 持ち込み元一覧（現行 → 移行先）

### 4.1 `hskksk/podcaster`（現在の monorepo）

| 現行パス | 移行先 | 備考 |
|----------|--------|------|
| `content/docs/**` | `knowledge/content/ai-podcast/**` | ポッドキャスト wiki 正本 |
| `content/web-clips/**` | `knowledge/notes/{slug}/**` + `kind: web-clip` | **content から notes へ（フラット）** |
| `content/keystatic-templates/**` | `knowledge/content/keystatic-templates/**` | テンプレ名を新コレクションに合わせる |
| `chugaku-juken/**` | `knowledge/content/juken/**` | **`content/` 配下** |
| `.github/workflows/ingest-queued.yml` | `knowledges/.github/workflows/` | ingest；`dispatch-podcaster-deploy.yml` が podcaster deploy を dispatch |
| 執筆系 `.agents/skills/` | `knowledge/.agents/skills/` | 保存先パスを新レイアウトに更新 |
| `apps/web`, `scripts/ingest-queued.ts` 等 | platform | パス定数・Capture collection マッピングを追随 |

### 4.2 `hskksk/blog`（既存 private）

| 現行パス | 移行先 | 備考 |
|----------|--------|------|
| `articles/**/YYYY.md`（公開済み） | `knowledge/content/blog/{slug}/index.mdoc` | mdoc 化 |
| `articles/**/input/**` | `knowledge/notes/memos/...` | 年別サブディレクトリは任意 |
| `ideas/**` | `knowledge/notes/{slug}/` + `kind: idea` | |
| `knowledges/**` | `knowledge/notes/{slug}/` + `tags: [survey, knowledge]` | wiki 化 → `content/ai-podcast` |
| `articles/**/input/**` 等 | `knowledge/notes/{slug}/` + `kind: memo` | |
| `styles/conversation_style/**` | 各 `content/blog/{slug}/` へ | |
| リポ全体 | **`hskksk/knowledge` にマージ推奨** | blog 単体のまま submodule も可だが二重管理になりやすい |

### 4.3 Zenn / note（将来）

正本は `content/blog/index.mdoc`。export CI は `knowledge` 上で動かす。

---

## 5. コンポーネントと所有リポ

| コンポーネント | 所有リポ | 接続 |
|----------------|----------|------|
| Keystatic | platform UI | commit → `hskksk/knowledge`（`content/*` と `notes/web-clips`） |
| Capture 既定 | platform | **`notes/web-clips`**（`collection: web-clips` は論理名のまま、物理パスだけ変更） |
| `ingest:queued` CI | **private** | `content/ai-podcast/**`（+ `content/blog/**` で queued なら） |
| 公開 SSG | platform | Build 時 `KNOWLEDGE_*` で clone した作業コピーを読む |

---

## 6. 移行フェーズ（PR 境界案）

```
Phase S0  knowledge リポ作成（§2 の空ディレクトリ）
Phase S1  podcaster から ai-podcast / juken / notes/web-clips へ物理移動
Phase S2  knowledge checkout + パス追随（web, scripts, Capture）。Vercel Secrets
Phase S3  ingest-queued を knowledges へ + DB content_path バックフィル（完了）
Phase S4  blog 統合 + notes/{ideas,knowledges,memos}
Phase S5  blog 配信（channels）+ Zenn export
```

S1 と S2 は同一メンテナンスウィンドウ推奨。

---

## 7. 未決定事項

1. private リポ名: `knowledge` 新設 vs `blog` 拡張リネーム  
2. `kind: web-clip` の notes を公開サイトにゲート付きで見せるか  
3. `tags` の正規化（許可リストを CI に置くか）  
4. ingest スクリプト共有: vendored vs パッケージ

---

## 8. 関連ドキュメント

- [pkm-migration.md](./pkm-migration.md) — コレクション 2 つは **論理名**（wiki=ai-podcast、clips=notes/web-clips）として読み替え
- [pkm-next.md](./pkm-next.md)
- Juken README: `hskksk/knowledges` の `content/juken/README.md`