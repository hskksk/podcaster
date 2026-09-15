---
name: oss-arch-research
description: OSSリポジトリ（特にAI・エージェント関連）のアーキテクチャ、設計思想、開発原則、導入ツールを調査し、詳細なドキュメントを作成します。リポジトリの指定がない場合は awesome-agents 等から未調査のものを自動選定します。
---

## What I do

指定されたOSSリポジトリ（または自動選定したAI・エージェント関連のOSS）について深く調査し、そのアーキテクチャ、設計思想、開発原則、導入されている品質向上ツールなどをまとめた詳細な Markdown レポートを作成します。レポートはシリーズものとして `content/web-clips/` に保存され、PRが作成されます。

1. **対象の選定**: 指定がない場合は `awesome-agents` 等を参照し、`content/docs/` に存在しない未調査のOSSを選定します。
2. **多角的なリサーチ**: GitHubリポジトリ、Wiki、公式ドキュメント、技術ブログ等を検索・取得し、システムのアーキテクチャや設計思想を深掘りします。
3. **レポート保存**: シリーズタイトルを含めた Markdoc として `content/web-clips/` に保存します。
4. **PR 作成**: origin/main ベースのブランチを作成して PR を出します（マージしても TTS は走りません。`podcast: none`）。

## When to use me

- `/oss-arch-research <OSS名やリポジトリURL>` の形式で呼び出す
- または単に `/oss-arch-research` と呼び出して自動選定させる
- 例: `/oss-arch-research AutoGPT`
- 例: `/oss-arch-research`

## Instructions

あなたはソフトウェアエンジニア・リサーチャーとして、OSSのアーキテクチャや設計思想を調査し、シリーズものの技術ドキュメントを作成するエージェントです。以下の手順に従ってタスクを実行してください。

### ステップ 1: 調査対象の決定

- ユーザーから特定のOSS名やリポジトリURLが指定されている場合は、それをターゲットとします。
- 指定がない場合：
  1. `web_fetch` 等を使用して `https://github.com/kyrolabs/awesome-agents` や類似のキュレーションリストを取得します。
  2. `list_directory` や `glob` を使ってローカルの `content/docs/` 以下のディレクトリ名を調べ、既に調査済みのOSSを把握します。
  3. まだ調査されていない、人気のある（スター数が多い）メジャーなAI/エージェント関連OSSを1つ選び、ターゲットとしてユーザーに宣言します。

### ステップ 2: 徹底的なリサーチ

ターゲットのOSSについて、以下の情報源を `web_fetch` や `google_web_search` を駆使して調査します。
- GitHubリポジトリ（README、CONTRIBUTING.md、アーキテクチャ図、ディレクトリ構造）
- Wikiや公式ドキュメント（DeepWikiなど）
- 開発者のブログ、設計に関するディスカッション、Issue/PR

**調査するべき主要項目:**
- **概要・ビジョン**: 何を解決するためのシステムか
- **システムアーキテクチャ**: 主要モジュール、データフロー、外部依存関係
- **設計思想・開発原則**: どのような思想で作られているか（例: 疎結合、プラグインアーキテクチャ等）
- **コーディング規約・プロジェクト構造**: ディレクトリ構成、モジュール分割のルール
- **システム品質向上のためのツール**: 導入されているリンター、テストフレームワーク、CI/CDツールなど

### ステップ 3: Markdown レポート作成

収集した情報を以下の構成で Markdown にまとめます。シリーズものとして統一感を持たせます。

```markdown
# OSSアーキテクチャ深掘りシリーズ: <OSS名> のアーキテクチャと設計思想

## 1. 概要とプロジェクトのビジョン
（OSSの概要、解決する課題、ターゲットユーザー）

## 2. システムアーキテクチャ
（主要なコンポーネント、モジュール間の関係性、データフロー）

## 3. 設計思想と開発の原則
（中核となる設計パターン、設計のトレードオフ、思想）

## 4. プロジェクト構造とコーディング規約
（ディレクトリ構成の意味、採用されている規約）

## 5. 品質保証と導入ツール
（テスト戦略、CI/CDパイプライン、静的解析ツールなど、開発の質を保つための仕組み）

## 6. まとめと学び
（このOSSから学べるベストプラクティス）

## 参考リンク
（調査に使用したリポジトリやドキュメントのURL一覧）
```

### ステップ 4: content/web-clips/ に保存して PR を作成する

1. `content/web-clips/YYYYMMDD_HHMMSS_oss_arch_<oss-name>/index.mdoc` というパスでレポートを保存します。先頭に YAML frontmatter:

   ```markdown
   ---
   title: "OSSアーキテクチャ深掘りシリーズ: <OSS名> のアーキテクチャと設計思想"
   clippedAt: "YYYY-MM-DDTHH:MM:SS.000Z"
   podcast: none
   legacyFilename: YYYYMMDD_HHMMSS_oss_arch_<oss-name>.md
   ---
   ```

2. origin/main ベースの新しいブランチを作成してコミットします:
   ```bash
   SLUG="YYYYMMDD_HHMMSS_oss_arch_<oss-name>"
   BRANCH="article/$SLUG"
   git checkout -b "$BRANCH" origin/main
   git add "content/web-clips/$SLUG/index.mdoc"
   git commit -m "Add OSS research article: <OSS名>"
   git push -u origin "$BRANCH"
   ```
3. PR を作成します:
   - `gh` CLI が使える場合:
     ```bash
     gh pr create \
       --base main \
       --title "OSS Arch Research: <OSS名>" \
       --body "## 概要

知識として content/web-clips に入れます。マージしても TTS は実行しません（podcast: none）。

- ファイル: content/web-clips/$SLUG/index.mdoc
- テーマ: <OSS名> のアーキテクチャと設計思想"
     ```
   - `gh` CLI が使えない場合は、ユーザーに手動で PR を作成するよう案内します。
4. レポートの概要をユーザーに提示し、「`content/web-clips/` に保存して PR を作成しました。`podcast: none` のままなので自動 ingest はしません。queued は明示したときだけ。」と報告して完了します。
