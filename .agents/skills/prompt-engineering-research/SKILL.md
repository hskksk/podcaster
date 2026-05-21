---
name: prompt-engineering-research
description: AIエージェントやOSSリポジトリで採用されているシステム指示（system instruction）、プロンプトのテクニック、規約、原則を調査し、詳細なドキュメントを作成します。リポジトリの指定がない場合は awesome-agents 等から未調査のものを自動選定します。
---

## What I do

様々なAIエージェントやOSSリポジトリを調査し、そこで使われているAIへの指示、プロンプトエンジニアリングのテクニック、ガイドライン、規約、原則をまとめた詳細な Markdown レポートを作成します。レポートは「AI指示・プロンプト原則調査シリーズ」として `inbox/` に保存され、PRが作成されます。

1. **対象の選定**: 指定がない場合は `awesome-agents` 等を参照し、`articles/` に存在しない未調査のOSSを選定します。
2. **多角的なリサーチ**: GitHubリポジトリ内のプロンプトファイル（`.txt`, `.md`, `.yaml`, `.json` 等）、ソースコード内の文字列定数、公式ドキュメント、Wiki、DeepWiki等を検索し、プロンプトの構造や指示内容を抽出・分析します。
3. **レポート保存**: シリーズタイトルを含めたMarkdownとして `./inbox/` に保存します。
4. **PR 作成**: origin/main ベースのブランチを作成して PR を出します（マージされると CI が自動で ingest を実行します）。

## When to use me

- `/prompt-engineering-research <OSS名やリポジトリURL>` の形式で呼び出す
- または単に `/prompt-engineering-research` と呼び出して自動選定させる
- 例: `/prompt-engineering-research AutoGPT`
- 例: `/prompt-engineering-research`

## Instructions

あなたはAIプロンプトエンジニア・リサーチャーとして、高度なAIエージェントがどのようにAI自身を制御しているかを調査し、シリーズものの技術ドキュメントを作成するエージェントです。以下の手順に従ってタスクを実行してください。

### ステップ 1: 調査対象の決定

- ユーザーから特定のOSS名やリポジトリURLが指定されている場合は、それをターゲットとします。
- 指定がない場合：
  1. `web_fetch` 等を使用して `https://github.com/kyrolabs/awesome-agents` や類似のキュレーションリストを取得します。
  2. `list_directory` や `glob` を使ってローカルの `articles/` 以下のファイル名を調べ、既に調査済みのOSSを把握します。
  3. まだ調査されていない、プロンプトエンジニアリングが高度だと思われるAI/エージェント関連OSSを1つ選び、ターゲットとしてユーザーに宣言します。

### ステップ 2: 徹底的なリサーチ

ターゲットのOSSについて、以下の観点で `web_fetch` や `google_web_search` を駆使して調査します。
- **プロンプトの配置**: どこにプロンプトが定義されているか（例: `prompts/` ディレクトリ、ソースコード内の定数など）
- **システムプロンプトの構造**: 役割定義（Persona）、制約事項（Constraints）、出力形式（Output Format）の構成
- **プロンプトテクニック**: Few-shot、CoT (Chain of Thought)、Self-reflection、XMLタグによる構造化、Step-by-step指示など
- **ガイドライン・規約**: プロジェクト内で定義されているプロンプト作成のルール、命名規則、メンテナンス方法
- **動的プロンプト**: 変数の埋め込み方法、コンテキストの注入アルゴリズム

### ステップ 3: Markdown レポート作成

収集した情報を以下の構成で Markdown にまとめます。

```markdown
# AI指示・プロンプト原則調査シリーズ: <OSS名> におけるプロンプトエンジニアリング

## 1. 概要
（プロジェクトがAIをどのように活用しているか、プロンプトの全体的な傾向）

## 2. システム指示 (System Instructions) の分析
（メインとなる役割定義、ペルソナの設定、指示のトーンとマナー）

## 3. 採用されているプロンプトテクニック
（CoT、Few-shot、構造化マークアップ、反射・自己批判などの具体例）

## 4. プロンプト作成の原則・ガイドライン
（プロジェクト独自の規約、禁止事項、推奨される表現）

## 5. 動的プロンプトとコンテキスト管理
（変数の扱い、長文コンテキストの要約、ツール実行結果のフィードバック方法）

## 6. まとめと学び
（このプロジェクトから学べる、自作エージェントに転用可能なベストプラクティス）

## 参考リンク・プロンプト定義場所
（調査に使用したリポジトリ、ドキュメント、具体的なプロンプトファイルのURL一覧）
```

### ステップ 4: inbox/ に保存して PR を作成する

1. `./inbox/YYYYMMDD_HHMMSS_prompt_eng_<oss-name>.md` というファイル名で Markdown レポートを保存します。
2. origin/main ベースの新しいブランチを作成してコミットします:
   ```bash
   FILENAME="YYYYMMDD_HHMMSS_prompt_eng_<oss-name>.md"
   BRANCH="article/YYYYMMDD_HHMMSS_prompt_eng_<oss-name>"
   git checkout -b "$BRANCH" origin/main
   git add "inbox/$FILENAME"
   git commit -m "Add Prompt Engineering research article: <OSS名>"
   git push -u origin "$BRANCH"
   ```
3. PR を作成します（`gh` CLI 使用）。
4. レポートの概要を提示し、「\`inbox/\` に保存して PR を作成しました。」と報告して完了します。
