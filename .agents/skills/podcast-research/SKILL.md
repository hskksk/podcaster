---
name: podcast-research
description: Research a topic deeply, save a Markdoc report to content/web-clips/, and create a PR (does not auto-ingest)
license: MIT
compatibility: claude-code
allowed-tools:
  - WebSearch
  - WebFetch
  - Write
  - Read
  - Bash(git checkout -b article/*)
  - Bash(git add content/web-clips/*)
  - Bash(git commit -m*)
  - Bash(git push -u origin article/*)
  - Bash(gh pr create*)
metadata:
  audience: podcast producers
---

## What I do

指定されたテーマについて深く調査し、ポッドキャスト台本生成用の詳細な Markdown レポートを作成します。

1. **多角的なリサーチ**: 概要・背景・詳細・最新動向・具体例・関連トピックを複数回のWeb検索で収集
2. **レポート保存**: `content/web-clips/` に Markdoc (`index.mdoc`) として保存する
3. **PR 作成**: origin/main ベースのブランチを作成して PR を出す（マージしても TTS は走らない。`podcast: none`）

## When to use me

- `/podcast-research <テーマ>` の形式で呼び出す
- 例: `/podcast-research モジュラー曲線と楕円曲線の関係`

## Instructions

あなたはポッドキャスト制作用のリサーチエージェントです。
以下の手順で指定テーマを徹底調査し、詳細な Markdown レポートを作成してください。

### ステップ 1: リサーチ計画

まずテーマを分析し、調査すべきサブトピックを列挙する（最低8〜12項目）。
- 概要・定義・歴史的背景
- 核となる概念・理論・仕組み
- 具体例・応用事例
- 重要人物・論文・文献
- 最新の動向・未解決問題
- 関連する隣接分野との接続

### ステップ 2: 徹底的なWeb調査

各サブトピックについてWebSearchとWebFetchを繰り返し実行する。
- **検索は最低15回以上** 行い、日本語・英語の両方で検索する
- 重要なページは WebFetch で全文取得して詳細を把握する
- Wikipedia、arXiv、技術ブログ、公式ドキュメントなど複数ソースを参照する
- 数式・アルゴリズム・定理は正確に記録する

### ステップ 3: Markdown レポート作成

収集した情報を以下の構成で Markdown にまとめる。

**目標文字数: 約2万字**（長すぎると生成音声が長くなりコスト増・品質劣化の原因となるため）

```markdown
# <テーマタイトル>

## 概要
（テーマの全体像・重要性・なぜ面白いか）

## 背景・歴史
（どのような経緯で生まれ、発展してきたか）

## 核となる概念
### <概念1>
### <概念2>
...

## 詳細な仕組み・理論
（技術的・数学的な詳細。数式は LaTeX 記法で記述）

## 具体例・応用事例
（実際の例、ケーススタディ）

## 重要人物・文献
（関連する人物、論文、書籍）

## 最新動向・未解決問題
（現在進行形のトピック）

## 関連トピック
（隣接する概念・分野へのつながり）

## 参考リンク
（調査に使用したURL一覧）
```

### ステップ 4: content/web-clips/ に保存して PR を作成する

ユーザーの確認は不要。以下を順に実行する。

1. `content/web-clips/YYYYMMDD_HHMMSS_<テーマ>/index.mdoc` にレポートを保存する。先頭に YAML frontmatter を付ける（本文のプロスは Markdown のまま。数式は `$...$` / `$$` でよい）:

   ```markdown
   ---
   title: "<テーマタイトル>"
   clippedAt: "YYYY-MM-DDTHH:MM:SS.000Z"
   podcast: none
   legacyFilename: YYYYMMDD_HHMMSS_<topic-slug>.md
   ---
   ```

2. origin/main ベースの新しいブランチを作成してコミット:
   ```bash
   SLUG="YYYYMMDD_HHMMSS_<topic-slug>"
   BRANCH="article/$SLUG"
   git checkout -b "$BRANCH" origin/main
   git add "content/web-clips/$SLUG/index.mdoc"
   git commit -m "Add podcast research article: <テーマ>"
   git push -u origin "$BRANCH"
   ```
3. PR を作成する:
   - `gh` CLI が使える場合:
     ```bash
     gh pr create \
       --base main \
       --title "Podcast Research: <テーマ>" \
       --body "## 概要

知識として content/web-clips に入れます。マージしても TTS は実行しません（podcast: none）。

- ファイル: content/web-clips/$SLUG/index.mdoc
- テーマ: <テーマ>"
     ```
   - `gh` CLI が使えない場合: ブランチ名（`$BRANCH`）をユーザーに伝えて手動で PR 作成するよう案内する
4. レポートの概要（見出し一覧と文字数）をユーザーに提示する
5. 「`content/web-clips/` に保存して PR を作成しました。main にマージしても自動 ingest / TTS は走りません。」と伝える

### 注意事項

- `content/web-clips/` ディレクトリは存在しない場合は作成する
- ファイル名のテーマ部分はファイルシステムで安全な文字のみ使用する（スペースはアンダースコアに）
- リサーチ中は進捗を都度報告する（「〇〇について調査中...」など）
- 情報の信頼性が低い場合はその旨を明記する
- `podcast: queued` にはしない（Phase 3 まで queued の自動 ingest が無い）
