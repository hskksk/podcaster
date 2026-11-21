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
| **`hskksk/knowledge`**（新規・名称は確定前） | **private** | 知識の **正本**（Markdoc）、Keystatic が commit する先、ポッドキャスト `podcast: queued` の検知、`ingest:queued` の書き戻し、（将来）Zenn / note 向け export |

命名: 本稿では private を **`hskksk/knowledge`** と呼ぶ。既存 **`hskksk/blog`** をベースに拡張してもよい（§4.2 参照）。

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
├── notes/                          # 非公開メモ（Keystatic の web-clips コレクションはここ）
│   ├── ideas/                      # 記事アイデア・走り書き
│   ├── knowledges/                 # 調査メモ（wiki 化前）
│   ├── memos/                      # 一般メモ・ブログ起こし input 等
│   └── web-clips/                  # URL クリップ・Capture 既定先（旧 content/web-clips）
│       └── {slug}/index.mdoc
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
| Web clip | `notes/web-clips/{slug}/index.mdoc` | `/podcast/web-clips`（ゲート付き）または非掲載 | ❌ 既定 none |

既存 DB の `content_path` は移行 PR で **`content/docs/…` → `content/ai-podcast/…`**、**`content/web-clips/…` → `notes/web-clips/…`** に一括リマップする（または ingest_meta で両方を OR）。新規は新パスのみ。

### 2.2 Keystatic コレクション（案）

| コレクション | `path` | 備考 |
|--------------|--------|------|
| AI Podcast Articles | `content/ai-podcast/*/` | 旧 `docs` |
| Web Clips & Notes | `notes/web-clips/*/` | 旧 `content/web-clips` |
| Blog Posts | `content/blog/*/` | 新設 |

`ideas` / `knowledges` / `memos` は **コレクション外**（エージェント・エディタ直書き or 将来コレクション化）。

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

**知識ファイルはすべて submodule `knowledge/` 経由**。ルートの `content/`・`chugaku-juken/` は持たない。

```text
podcaster/                          # public
├── .gitmodules                     # knowledge → 固定コミット SHA
├── knowledge/                      # submodule（§2 のツリー全体）
├── apps/web/                       # SSG: content/ai-podcast, content/juken, content/blog
├── …                               # §2 以前版と同様（supabase, scripts, docs, …）
```

### 3.1 ローカル開発

```bash
git clone --recurse-submodules git@github.com:hskksk/podcaster.git
```

| 変数 | 用途 |
|------|------|
| `CONTENT_ROOT` | 既定: `$REPO_ROOT/knowledge` |
| `KEYSTATIC_GITHUB_REPO` | 既定: `hskksk/knowledge` |

読み取りパス（実装時）:

- ポッドキャスト wiki: `path.join(CONTENT_ROOT, "content/ai-podcast")`
- Juken: `path.join(CONTENT_ROOT, "content/juken")`
- Web clips: `path.join(CONTENT_ROOT, "notes/web-clips")`
- Blog: `path.join(CONTENT_ROOT, "content/blog")`

### 3.2 Vercel

 submodule 有効化・Keystatic の runtime commit 先は **private 全体**（`content/` と `notes/` の両方）。公開 HTML は submodule の **ビルド時スナップショット**（従来どおり）。

---

## 4. 持ち込み元一覧（現行 → 移行先）

### 4.1 `hskksk/podcaster`（現在の monorepo）

| 現行パス | 移行先 | 備考 |
|----------|--------|------|
| `content/docs/**` | `knowledge/content/ai-podcast/**` | ポッドキャスト wiki 正本 |
| `content/web-clips/**` | `knowledge/notes/web-clips/**` | **content から notes へ** |
| `content/keystatic-templates/**` | `knowledge/content/keystatic-templates/**` | テンプレ名を新コレクションに合わせる |
| `chugaku-juken/**` | `knowledge/content/juken/**` | **`content/` 配下** |
| `.github/workflows/ingest-queued.yml` | `knowledge/.github/workflows/` | 走査パスを `content/ai-podcast`（+ 任意 `content/blog`）に変更 |
| 執筆系 `.agents/skills/` | `knowledge/.agents/skills/` | 保存先パスを新レイアウトに更新 |
| `apps/web`, `scripts/ingest-queued.ts` 等 | platform | パス定数・Capture collection マッピングを追随 |

### 4.2 `hskksk/blog`（既存 private）

| 現行パス | 移行先 | 備考 |
|----------|--------|------|
| `articles/**/YYYY.md`（公開済み） | `knowledge/content/blog/{slug}/index.mdoc` | mdoc 化 |
| `articles/**/input/**` | `knowledge/notes/memos/...` | 年別サブディレクトリは任意 |
| `ideas/**` | `knowledge/notes/ideas/**` | |
| `knowledges/**` | `knowledge/notes/knowledges/**` | wiki 化 → `content/ai-podcast` |
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
| 公開 SSG | platform | submodule の `content/ai-podcast`, `content/juken`, `content/blog` |

---

## 6. 移行フェーズ（PR 境界案）

```
Phase S0  knowledge リポ作成（§2 の空ディレクトリ）
Phase S1  podcaster から ai-podcast / juken / notes/web-clips へ物理移動
Phase S2  platform submodule + パス追随（web, scripts, ingest-queued, Capture）
Phase S3  ingest-queued を knowledge へ + DB content_path バックフィル
Phase S4  blog 統合 + notes/{ideas,knowledges,memos}
Phase S5  blog 配信（channels）+ Zenn export
```

S1 と S2 は同一メンテナンスウィンドウ推奨。

---

## 7. 未決定事項

1. private リポ名: `knowledge` 新設 vs `blog` 拡張リネーム  
2. `notes/web-clips` を公開サイトにゲート付きで見せるか、昇格後は ai-podcast だけ見せるか  
3. `memos/` の内部規約（ブログ `input/` をフラットにするか `memos/blog/YYYY/` とするか）  
4. ingest スクリプト共有: vendored vs パッケージ

---

## 8. 関連ドキュメント

- [pkm-migration.md](./pkm-migration.md) — コレクション 2 つは **論理名**（wiki=ai-podcast、clips=notes/web-clips）として読み替え
- [pkm-next.md](./pkm-next.md)
- [chugaku-juken/README.md](../../chugaku-juken/README.md) — 移行後は `knowledge/content/juken/README.md` に追随