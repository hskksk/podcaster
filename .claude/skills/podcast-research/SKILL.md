---
name: podcast-research
description: Research a topic deeply, save a markdown report to draft/, register to mem.ai, and trigger the podcast ingest pipeline
license: MIT
compatibility: claude-code
metadata:
  audience: podcast producers
  tools:
    - WebSearch
    - WebFetch
    - Write
    - Read
    - Bash
---

## What I do

指定されたテーマについて深く調査し、ポッドキャスト台本生成用の詳細な Markdown レポートを作成します。

1. **多角的なリサーチ**: 概要・背景・詳細・最新動向・具体例・関連トピックを複数回のWeb検索で収集
2. **レポート保存**: `./draft/` に Markdown として保存する
3. **mem.ai 登録 → ingest 投入**: mem.ai に登録して note ID を取得し、ingest エンドポイントへ POST する

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

**目標文字数: 約1万字**（長すぎると生成音声が長くなりコスト増・品質劣化の原因となるため）

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

### ステップ 4: mem.ai に登録して ingest エンドポイントへ POST

ユーザーの確認は不要。以下を順に実行する。

1. `./draft/YYYYMMDD_HHMMSS_<テーマ>.md` に Markdown レポートを保存する
2. `mem-ai` CLI でレポートを mem.ai に登録し、note ID を取得する:
   ```bash
   NOTE_ID=$(mem-ai --json note create \
     --file ./draft/<ファイル名> \
     --collection-title "Podcast Research" \
     | jq -r '.id')
   ```
3. `scripts/ingest.ts` で ingest エンドポイントへ POST する（URL とサービスキーは supabase CLI から自動取得）:
   ```bash
   pnpm tsx scripts/ingest.ts "$NOTE_ID"
   ```
4. レポートの概要（見出し一覧と文字数）をユーザーに提示する
5. POST 結果（article_id）を報告し、「mem.ai にレポートを登録し、ポッドキャスト生成パイプラインに投入しました。」と伝える

### 注意事項

- draft ディレクトリは存在しない場合は作成する
- ファイル名のテーマ部分はファイルシステムで安全な文字のみ使用する（スペースはアンダースコアに）
- リサーチ中は進捗を都度報告する（「〇〇について調査中...」など）
- 情報の信頼性が低い場合はその旨を明記する
- mem.ai のコンテンツ上限は 200,000 文字（UTF-8）。レポートが超える場合は冒頭に警告コメントを追記して truncate する
