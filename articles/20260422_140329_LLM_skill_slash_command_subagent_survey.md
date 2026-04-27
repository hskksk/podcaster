# LLM Skill・スラッシュコマンド・Subagentの総合サーベイ 2026年版

## 概要

AIコーディングアシスタント、特にClaude Codeを中心に、2025〜2026年にかけて急速に発展した「LLM Skill（スキル）」「スラッシュコマンド（Slash Command）」「Subagent（サブエージェント）」の三つのエコシステムを徹底的にサーベイする。これらは単なる機能拡張にとどまらず、AIエージェントが人間の開発ワークフローにどう組み込まれるかを根本から変えつつある技術群である。

Claude Codeは2026年のAIコーディングツールランキングでトップ（SWE-bench Verified 80.8%）に立つが、その強さの背景には、ユーザーが自分のワークフローをAIに「教える」ためのリッチな拡張機構がある。スキル・スラッシュコマンド・サブエージェントはいずれも、「同じ指示を毎回入力しなくて済む」ための仕組みであり、その設計思想・実装方法・コミュニティエコシステムを深く掘り下げる。

---

## 背景・歴史

### コマンドからスキルへの進化

Claude Codeは当初、`.claude/commands/*.md` というMarkdownファイルでカスタムコマンドを定義する仕組みを持っていた。これは単純で、ファイルを置くとスラッシュコマンドとして使えるというものだった。

2025年12月、Anthropicは「Agent Skills」をオープンスタンダードとして公開（[agentskills.io](https://agentskills.io)）。これはClaude Codeだけでなく、OpenAI Codex、Google Gemini CLI、Cursor、Windsurf等の複数のAIツールで共通して使えるスキル形式の標準仕様だ。

2026年1月のClaude Code 2.1.0アップデートでは「ホットリロード」が導入され、スキルファイルを編集すると即座にセッション内で反映されるようになった。これにより開発体験が大幅に改善された。

同時に、`.claude/commands/` と `.claude/skills/` が統合され、どちらのパスに置いても同じスラッシュコマンドとして機能するようになった。ただし `skills/` が推奨で、より多くの機能（サポートファイル、フロントマター制御、サブエージェント実行等）をサポートする。

### サブエージェントの登場

コンテキストウィンドウの限界という根本的な問題に対応するため、サブエージェントの概念が生まれた。メイン会話のコンテキストを守りながら、大量の探索・調査・実行をアイソレートされた空間で行い、結果のサマリーだけを返す仕組みだ。

2026年2月5日、Anthropicは Claude Opus 4.6とともに「Agent Teams」（エージェントチーム）を実験的機能として公開。複数のClaude Codeインスタンスが独立したコンテキストウィンドウを持ちながら、ピアツーピアで通信・協調できる仕組みだ。

---

## 核となる概念：LLM Skill（スキル）

### スキルとは何か

スキルは「特定タスクのための再利用可能なプレイブック」である。同じ手順を毎回チャットに貼り付ける代わりに、`SKILL.md` ファイルに書いておけば `/スキル名` で呼び出せる。

スキルは二つの使われ方をする：
1. **Claude が自動的に使う**：スキルのdescriptionを見て、現在の会話に関連すると判断したら自動ロード
2. **ユーザーが明示的に呼ぶ**：`/スキル名` でいつでも呼び出し

重要なのは、スキルの「本文」はコンテキストに入れず、descriptionのみを常に保持している点だ。スキルが実際に呼び出されたとき初めて本文がコンテキストに入る。これにより、大量のスキルを登録してもコンテキスト消費が最小限に抑えられる。

### スキルファイルの構造

スキルは以下のディレクトリ構造を持つ：

```
my-skill/
├── SKILL.md           # メイン指示（必須）
├── template.md        # テンプレート（任意）
├── examples/
│   └── sample.md      # 出力例（任意）
└── scripts/
    └── validate.sh    # 実行スクリプト（任意）
```

`SKILL.md` はYAMLフロントマター + Markdownの形式：

```yaml
---
name: explain-code
description: コードを視覚的な図と例えで説明する。「これどう動くの？」という質問に使う
---

コードを説明するときは必ず以下を含めること：

1. **まず例え話から**：コードを日常生活に例える
2. **図を描く**：ASCIIアートでフロー・構造を示す
3. **ステップバイステップで説明**
4. **落とし穴を一つ挙げる**

説明は会話調で。複雑な概念には複数の例えを使う。
```

### フロントマターフィールド詳解

スキルのフロントマターで設定できる全フィールド（[公式ドキュメント](https://code.claude.com/docs/en/skills)）：

| フィールド | 説明 |
|-----------|------|
| `name` | スキル名（スラッシュコマンド名）。小文字・数字・ハイフンのみ、最大64文字 |
| `description` | スキルの説明。Claudeが自動使用判断に使う。1536文字以内 |
| `when_to_use` | 追加のトリガー説明。`description`に加算される |
| `argument-hint` | オートコンプリート時に表示するヒント（例：`[issue-number]`） |
| `arguments` | 名前付き引数定義（位置引数にマップされる） |
| `disable-model-invocation` | `true`にするとClaudeが自動実行しない（手動専用） |
| `user-invocable` | `false`にすると`/`メニューに表示されない（Claude専用） |
| `allowed-tools` | このスキル実行中に許可するツール（都度確認なし） |
| `model` | このスキル実行中に使うモデル（`sonnet`/`opus`/`haiku`） |
| `effort` | 推論努力レベル（`low`/`medium`/`high`/`xhigh`/`max`） |
| `context` | `fork`にするとサブエージェントとして実行 |
| `agent` | `context: fork`時に使うサブエージェントタイプ |
| `hooks` | このスキルのライフサイクルフック |
| `paths` | このスキルが有効になるファイルパスのglobパターン |
| `shell` | インラインシェルコマンドのシェル（`bash`/`powershell`） |

### 文字列置換（引数の使い方）

スキルは動的な値を使える：

```yaml
---
name: fix-issue
description: GitHub issue番号でバグを修正する
disable-model-invocation: true
---

GitHub issue $ARGUMENTS のバグを修正する：

1. issueの内容を読む
2. 要件を理解する
3. 修正を実装する
4. テストを書く
5. コミットを作る
```

`/fix-issue 123` と入力すると `$ARGUMENTS` が `123` に置換される。

位置引数：
- `$ARGUMENTS[0]`、`$ARGUMENTS[1]`...
- 短縮形：`$0`、`$1`...
- 名前付き：`arguments: [issue, branch]` と定義して `$issue`、`$branch` で参照

その他の特殊変数：
- `${CLAUDE_SESSION_ID}` - セッションID
- `${CLAUDE_SKILL_DIR}` - スキルディレクトリのパス

### 動的コンテキスト注入（シェルコマンド実行）

バッククォートで囲んだコマンドは、スキル実行前にシェルで実行され、その出力がプロンプトに埋め込まれる：

```yaml
---
name: pr-summary
description: PRの変更をサマリーする
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## PRコンテキスト
- PR diff: !`gh pr diff`
- PRコメント: !`gh pr view --comments`
- 変更ファイル: !`gh pr diff --name-only`

## タスク
このPRの変更を日本語でサマリーしてください...
```

これは「プリプロセッシング」であり、Claudeが実行するのではなく、スキル読み込み前にシェルが実行する。

### スキルの保存場所と優先度

| 場所 | パス | スコープ | 優先度 |
|------|------|---------|-------|
| Enterprise | 管理設定 | 組織全体 | 最高 |
| Personal | `~/.claude/skills/<name>/SKILL.md` | 全プロジェクト | 高 |
| Project | `.claude/skills/<name>/SKILL.md` | 現在のプロジェクトのみ | 中 |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | プラグイン有効時 | 低 |

### スキルのサブエージェント実行

`context: fork` を設定すると、スキルがサブエージェントとして独立したコンテキストで実行される：

```yaml
---
name: deep-research
description: トピックを徹底的に調査する
context: fork
agent: Explore
---

$ARGUMENTS について徹底調査：

1. GlobとGrepで関連ファイルを見つける
2. コードを読んで分析する
3. 具体的なファイル参照とともに所見をまとめる
```

---

## ビルトインスキル（Bundled Skills）

Claude Codeには最初から組み込まれているスキルが複数ある。ビルトインコマンドとの違いは「プロンプトベース」であること—固定ロジックではなくClaudeにプレイブックを渡して実行させる。

### /simplify ― コード品質の自動チェック

**目的**：コード変更後に呼び出し、3つの並列エージェントが変更ファイルをレビューする

3つのエージェントが並列実行：
1. **コード再利用エージェント**：重複コード・抽出可能なロジックを検出
2. **コード品質エージェント**：可読性・命名・複雑度をチェック
3. **効率性エージェント**：パフォーマンスのボトルネックを特定

```
/simplify
/simplify "メモリ効率とエラーハンドリングに集中"
```

大規模リファクタリング後や、AIが生成したコードの一括受け入れ後に特に有効。未使用インポート、冗長な変数、共通ロジックの抽出機会、過複雑な条件分岐などを自動発見する。

参考：[/simplify and /batch Commands Guide](https://claudefa.st/blog/guide/mechanics/simplify-batch-commands)

### /batch ― 大規模並列変更のオーケストレーション

**目的**：コードベース全体にわたる大規模変更を並列エージェントで実行

3フェーズで動作：

**フェーズ1 - 調査と計画**：
- オーケストレーターがプランモードに入る
- Exploreエージェントを使ってコードベースを深く調査
- 5〜30の独立したユニットに作業を分解
- ユーザーに承認を求める

**フェーズ2 - 並列ワーカー起動**：
- 1ユニット1エージェントで真の並列実行
- 各エージェントに `isolation: worktree` でGitワークツリーを割り当て
- 各ワーカーが実装 → `/simplify` 実行 → テスト → コミット → PR作成

**フェーズ3 - 進捗トラッキング**：
- オーケストレーターがステータステーブルを更新
- 最終サマリー（例：「22/24ユニットがPRとしてランディング」）

```
/batch "すべてのコンポーネントでReact 18のuseEffect cleanup関数を追加する"
```

参考：[Claude Code Batch Processing Guide](https://smartscope.blog/en/generative-ai/claude/claude-code-batch-processing/)

### /debug ― セッションのデバッグ

セッションのデバッグログを分析して、ツール失敗やコンテキスト問題を診断する。Claude Code自体の動作を調べるのに使う。

### /loop ― 定期実行

スケジュールに基づいてプロンプトを繰り返し実行：

```
/loop 5m デプロイの状態を確認してエラーがあれば報告
/loop 2h テストスイートを実行して結果を要約
```

### /claude-api ― APIリファレンスロード

現在のプロジェクトの言語に応じたClaude APIドキュメントをコンテキストに読み込む（Python、TypeScript、Java等）。

### /review ― コードレビュー

PRをレビューしてバグ・ロジックエラー・エッジケースを指摘する。PR番号やURLを引数に取れる。

### /security-review ― セキュリティレビュー

現在のブランチの変更に対してセキュリティレビューを実施する。

---

## ビルトインスラッシュコマンド

スキルとは別に、Claude Codeには固定ロジックで動くビルトインコマンドがある。

### コンテキスト管理系

**`/compact`**  
会話履歴を圧縮する。オプションでフォーカスエリアを指定可能：
```
/compact
/compact "認証ロジックと最新のエラーに集中"
```

**`/memory`**  
Claude が自動保存しているプロジェクトコンテキスト（CLAUDE.md等）を表示・編集する。

**`/btw`**  
メイン会話に影響を与えずにサイドクエスチョンを投げる。ツールアクセスなし・回答はコンテキストに残らない。クイックな構文確認等に使う。

### ナビゲーション・操作系

**`/diff`**  
全ファイル変更のインタラクティブビューワーを開く。コミット前のチェックポイントとして使う。

**`/rewind`**  
会話とファイル変更を前のチェックポイントまで巻き戻す。Claudeが間違った方向に進んでいるときのリカバリに使う。

**`/plan`**  
変更を加えずに実装戦略を設計するプランモードに入る。まず全体方針を議論してから実行する。

### 計測・モニタリング系

**`/usage`**  
クォータ制限を確認する。

**`/cost`**  
セッションのAPIコストを確認（API利用のみ）。

**`/stats`**  
時系列での使用パターンを確認。

### モデル設定系

**`/model`**  
セッション中にAIモデルを切り替える。

**`/fast`**  
高速モードを有効化（Claude Opus 4.6の高速出力）。

### エージェント管理系

**`/agents`**  
サブエージェントを管理するタブ付きインターフェースを開く：
- **Running**タブ：実行中のサブエージェントの表示・停止
- **Library**タブ：サブエージェントの表示・作成・編集・削除

---

## Subagent（サブエージェント）詳解

### サブエージェントとは

サブエージェントは独自のコンテキストウィンドウ、カスタムシステムプロンプト、特定ツールアクセス、独立した権限を持つ特化AIアシスタントだ。

**使うべき場面**：
- 大量の検索結果・ログ・ファイル内容がメイン会話に流れ込んでしまうサイドタスク
- ツール制限を強制したいとき
- 結果がサマリーで十分な自己完結型タスク
- コストを抑えたいとき（Haiku等の安いモデルで処理）

**使うべきでない場面**：
- 頻繁なやりとりや反復的な改善が必要なタスク
- 複数フェーズが大量のコンテキストを共有するとき（計画→実装→テスト）
- レイテンシが重要なとき（サブエージェントは新鮮なコンテキストから始まる）

参考：[公式サブエージェントドキュメント](https://code.claude.com/docs/en/sub-agents)

### ビルトインサブエージェント

Claude Codeに標準搭載されているサブエージェント：

#### Explore（探索）
- **モデル**：Haiku（高速・低レイテンシ）
- **ツール**：読み取り専用（Write・Editは拒否）
- **用途**：ファイル探索・コード検索・コードベース理解
- **特徴**：thoroughness（徹底度）レベルを指定可能—`quick`（ターゲット絞り込み）、`medium`（バランス）、`very thorough`（包括分析）

#### Plan（計画）
- **モデル**：メイン会話から継承
- **ツール**：読み取り専用
- **用途**：プランモード中のコードベース調査

#### General-purpose（汎用）
- **モデル**：メイン会話から継承
- **ツール**：全ツール
- **用途**：探索と変更の両方が必要な複雑タスク

#### その他
- **statusline-setup**（Sonnet）：`/statusline`実行時のステータスライン設定
- **Claude Code Guide**（Haiku）：Claude Code機能に関する質問対応

### カスタムサブエージェントの作り方

**`/agents` コマンドを使う方法**（推奨）：
1. `/agents` を実行
2. **Library**タブ → **Create new agent** → **Personal**（全プロジェクトで使える）
3. **Generate with Claude**で説明を入力するとClaude が自動生成
4. ツール・モデル・カラーを選択
5. メモリスコープを設定

**手動でMarkdownファイルを作る方法**：

```markdown
---
name: code-reviewer
description: コード変更後にプロアクティブにレビューする品質・セキュリティ・保守性の専門家
tools: Read, Grep, Glob, Bash
model: inherit
---

あなたは高いコード品質とセキュリティ基準を維持するシニアコードレビュアーです。

呼び出されたとき：
1. git diffで最新の変更を確認
2. 変更されたファイルにフォーカス
3. 即座にレビューを開始

レビューチェックリスト：
- コードが明確で可読性が高いか
- 関数・変数の命名が適切か
- コードが重複していないか
- 適切なエラーハンドリングがあるか
- シークレットやAPIキーが露出していないか
- 入力バリデーションが実装されているか
- 十分なテストカバレッジがあるか
- パフォーマンスへの配慮があるか

フィードバックは優先度で整理：
- 重大な問題（必ず修正）
- 警告（修正すべき）
- 提案（改善を検討）

修正方法の具体例を含めること。
```

### フロントマターフィールド詳解

| フィールド | 説明 |
|-----------|------|
| `name` | 必須。一意な識別子（小文字・ハイフン） |
| `description` | 必須。Claudeがいつ委譲するかを判断する基準 |
| `tools` | 使用可能なツール（省略すると全ツール継承） |
| `disallowedTools` | 拒否するツール |
| `model` | `sonnet`/`opus`/`haiku`/フルモデルID/`inherit` |
| `permissionMode` | `default`/`acceptEdits`/`auto`/`dontAsk`/`bypassPermissions`/`plan` |
| `maxTurns` | 最大ターン数 |
| `skills` | 起動時にプリロードするスキル（descriptionでなく全文が注入される） |
| `mcpServers` | このサブエージェント専用のMCPサーバー |
| `hooks` | ライフサイクルフック |
| `memory` | 永続メモリスコープ（`user`/`project`/`local`） |
| `background` | `true`でバックグラウンド実行 |
| `effort` | 推論努力レベル |
| `isolation` | `worktree`でGitワークツリーに分離 |
| `color` | UIでの表示カラー |
| `initialPrompt` | `--agent`起動時の初期プロンプト |

### サブエージェントの起動方法

**1. 自動委譲**：descriptionを見てClaudeが判断

**2. 自然言語**：
```
code-reviewerサブエージェントを使って最近の変更をレビューして
```

**3. @メンション**（最も確実）：
```
@"code-reviewer (agent)" 認証モジュールの変更を確認して
```

**4. セッション全体をサブエージェントとして起動**：
```bash
claude --agent code-reviewer
```

### 永続メモリ機能

`memory` フィールドでサブエージェントにセッション間で学習を蓄積させられる：

```yaml
---
name: code-reviewer
description: コードレビューの専門家
memory: project
---

コードをレビューしながら、コードパス・パターン・ライブラリの場所・アーキテクチャの決定事項をエージェントメモリに記録してください。
これにより会話をまたいだ制度的知識が蓄積されます。
```

| スコープ | パス | 用途 |
|---------|------|------|
| `user` | `~/.claude/agent-memory/<name>/` | 全プロジェクト共通 |
| `project` | `.claude/agent-memory/<name>/` | プロジェクト固有・バージョン管理可能 |
| `local` | `.claude/agent-memory-local/<name>/` | プロジェクト固有・バージョン管理しない |

### Worktreeアイソレーション

`isolation: worktree` でサブエージェントに独立したGitワークツリーを割り当てる。変更がなければ自動クリーンアップ：

```yaml
---
name: experimental-refactor
description: 実験的なリファクタリングを安全に試す
isolation: worktree
---
```

### フックによる条件制御

サブエージェント内でフックを定義して、ツール使用前後に検証できる。例：読み取り専用DBクエリの強制：

```yaml
---
name: db-reader
description: 読み取り専用のDBクエリを実行する
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---
```

---

## Agent Teams（エージェントチーム）

### 概要

Agent Teamsは2026年2月5日に実験的機能として公開された、複数Claude Codeインスタンスの協調システムだ。

参考：[公式Agent Teamsドキュメント](https://code.claude.com/docs/en/agent-teams)

**有効化方法**：
```json
// settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### サブエージェントとの違い

| 特徴 | サブエージェント | エージェントチーム |
|------|-----------------|------------------|
| コンテキスト | メイン会話の子 | 独立したセッション |
| 通信 | 親のみに報告 | ピアツーピア通信可能 |
| 並列度 | セッション内 | 複数セッション |
| 用途 | コンテキスト節約 | 大規模協調タスク |

### 主なユースケース

- **並列調査・レビュー**：複数のチームメンバーが問題の異なる側面を同時調査
- **新機能開発**：フロントエンド・バックエンド・テストを別々のエージェントが担当
- **競合仮説のデバッグ**：複数エージェントが異なる仮説を並列検証
- **クロスレイヤー調整**：フロントエンド・バックエンド・テストにまたがる変更

### 実績

Anthropicの内部検証として、16のエージェントチームを使ってCコンパイラを構築：
- 約2,000セッション使用
- 入力トークン20億、出力トークン1.4億
- 10万行のRustコードを生成
- Linux 6.9カーネルのコンパイルに成功
- APIコスト約2万ドル

---

## Hooks（フック）詳解

フックは特定のイベントで自動実行されるシェルコマンド・プロンプト・エージェントだ。スキルやサブエージェントと組み合わせてワークフローを自動化する。

参考：[公式フックガイド](https://code.claude.com/docs/en/hooks-guide)

### フックイベント

| イベント | タイミング | 特徴 |
|---------|----------|------|
| `PreToolUse` | ツール実行前 | exit code 2でブロック可能 |
| `PostToolUse` | ツール実行後 | 実行をアンドゥ不可 |
| `SubagentStart` | サブエージェント開始時 | |
| `SubagentStop` | サブエージェント終了時 | |
| `Stop` | セッション終了時 | |

### 主要なフック活用パターン

**1. 自動フォーマット（PostToolUse）**：
Claudeがファイルを編集するたびにPrettierやBlackを自動実行。AIが生成したコードがプロジェクトのスタイルガイドに即座に適合する。

**2. セキュリティゲート（PreToolUse）**：
`drop table`等の危険なコマンドをブロック。exit code 2で拒否。

**3. テスト自動実行（PostToolUse）**：
ファイル変更後に自動でテストスイートを実行。正式なCI前にリグレッションを早期発見。

**4. Gitチェックポイント（PreToolUse）**：
Claudeが大規模な変更を行う前に自動でGitコミットを作成してセーフティネットを確保。

### ハンドラーの種類

- **command**：シェルコマンドを実行
- **prompt**：Claudeモデルに単一ターンの評価を要求
- **agent**：Read・Grep・Glob等のツールを持つサブエージェントを起動して深い検証を実施

---

## コミュニティエコシステム

### awesome-claude-code

**URL**：[https://github.com/hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)

Claude Code関連のスキル・フック・スラッシュコマンド・オーケストレーター・プラグイン等を網羅したキュレーションリスト。2026年時点で最も包括的なコミュニティリソース。

主なカテゴリ：
- Agent Skills（スキル集）
- Workflows & Knowledge Guides
- Team Workflows
- Ralph Wiggum Technique（自律コーディングループ）
- Tooling（ツール類）
- IDE Integrations
- Usage Monitors
- Orchestrators
- Config Managers
- Status Lines
- Hooks
- Slash-Commands
- CLAUDE.md Files

---

### VoltAgent/awesome-claude-code-subagents

**URL**：[https://github.com/VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents)

131以上のClaude Code特化サブエージェントを10カテゴリで分類：

**01. コア開発（11エージェント）**
- APIデザイナー、フロントエンド/バックエンド開発者、フルスタックエンジニア、モバイルスペシャリスト、UIデザイナー、WebSocketエンジニア

**02. 言語スペシャリスト（32エージェント）**
- TypeScript、Python、Go、Rust、Java、C#、PHP、JavaScript他24言語以上のエキスパート

**03. インフラ（16エージェント）**
- DevOps、Kubernetes、Docker、Terraform、AWS/Azure/GCP、データベース管理、SRE

**04. 品質・セキュリティ（16エージェント）**
- コードレビュー、ペネトレーションテスト、アクセシビリティテスト、カオスエンジニアリング、コンプライアンス監査、パフォーマンス最適化

**05. データ・AI（13エージェント）**
- 機械学習、NLP、データエンジニアリング、LLMアーキテクチャ、プロンプトエンジニアリング、DB最適化

**06. 開発者体験（14エージェント）**
- ビルドシステム、CLIツール開発、ドキュメント生成、Gitワークフロー、レガシー近代化、リファクタリング

**07. 専門ドメイン（13エージェント）**
- ブロックチェーン、ゲーム開発、IoT、フィンテック、ヘルスケア、決済システム、SEO

**08. ビジネス・プロダクト（12エージェント）**
- プロダクトマネジメント、プロジェクト管理、コンテンツマーケティング、法務・コンプライアンス、テクニカルライティング

**09. メタ・オーケストレーション（13エージェント）**
- マルチエージェント調整、ワークフローオーケストレーション、コンテキスト管理、MCPゲートウェイ

**10. リサーチ・分析（8エージェント）**
- 市場調査、競合分析、トレンド予測、科学文献調査

---

### VoltAgent/awesome-agent-skills

**URL**：[https://github.com/VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)

1100以上のエージェントスキルを集めたクロスプラットフォームコレクション。Claude Code、Codex、Gemini CLI、Cursor等で共通使用可能。

主なカテゴリと注目スキル：

**Anthropic公式スキル**
- ドキュメント作成（DOCX/PPTX/XLSX/PDF）
- デザインツール
- Webアーティファクト
- MCPビルダー
- ブランドガイドライン

**プラットフォーム・フレームワークスキル**
- **VoltAgent**：エージェントアーキテクチャとベストプラクティス
- **Angular**：コンポーネント生成・アプリスキャフォールディング
- **Google Gemini**：複数インターフェースのAPI開発
- **Stripe**：インテグレーション・SDK アップグレード

**クラウド・インフラ**
- **Cloudflare**：Workers、Pages、ストレージ、AI、セキュリティ
- **Netlify**：Functions、Edge Functions、データベース、フォーム
- **Vercel**：Reactパターン、Next.js最適化、キャッシュ戦略
- **AWS/Azure**：複数言語にわたる包括的SDK対応

**AI・機械学習**
- **Hugging Face**：データセット管理、モデルトレーニング、評価
- **fal.ai**：画像生成、3Dモデリング、動画作成、アップスケーリング
- **Replicate**：モデル探索・実行
- **OpenAI**：ドキュメント・デプロイ・セキュリティレビュー

**開発ツール**
- **HashiCorp Terraform**：プロバイダー開発、テスト、モジュール
- **WordPress**：ブロック開発、プラグイン、REST API、パフォーマンス
- **Microsoft**：.NET/Java/Python/TypeScript/Rustにわたる133以上のスキル

**セキュリティ・監査**
- **Trail of Bits**：スマートコントラクトセキュリティ、静的解析、脅威モデリング

**マーケティング・グロース**
- **Corey Haines**：SEO、コピーライティング、CRO、有料広告等33以上のスキル

**コンテンツ・デザイン**
- **Figma**：デザイン→コードワークフロー、デザインシステム
- **Sanity**：コンテンツモデリング、SEO最適化
- **Google Workspace**：Drive、Sheets、Gmail、Calendar、Docs

公式ディレクトリ：[officialskills.sh](https://officialskills.sh)

---

### claudekit

**URL**：[https://github.com/carlrannaberg/claudekit](https://github.com/carlrannaberg/claudekit)

20以上のサブエージェント、品質フック、チェックポインティングを含むClaude Code用のツールキット。

主な機能：

**コマンド**
- `/git:status` - 変更タイプ別にグループ化してコミット戦略を提案
- `/spec:create` - コードベースを調査してフルスペックを作成
- `/spec:execute` - 品質保証ワークフローで仕様を実装
- `/code-review` - 6つの専門エージェントが並列でコードを分析
- `/research [query]` - 専門サブエージェントによる深い並列調査
- `/validate-and-fix` - 全品質チェックと修正を実行

**品質フック**
- フック実行時間とアウトプットサイズのパフォーマンス分析
- `claudekit-hooks profile` コマンドで全フックをバッチプロファイリング
- 低速フック（5秒以上）とアウトプットサイズ超過の色分けアラート

---

### SuperClaude Framework

**URL**：[https://github.com/SuperClaude-Org/SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework)  
**PyPI**：`pip install superclaude`（最新版 2026年3月22日リリース）

Claude Codeを構造化開発プラットフォームに変えるメタプログラミング設定フレームワーク。30コマンド・20エージェント・7スキル・8MCP統合を提供。

**30のスラッシュコマンド**

*計画・設計*：
- `/brainstorm` - 構造化したブレインストーミング
- `/design` - システムアーキテクチャ計画
- `/estimate` - プロジェクトタイムライン・工数見積もり
- `/spec-panel` - 仕様評価

*開発*：
- `/implement` - コード作成ワークフロー
- `/build` - ビルドプロセス管理
- `/improve` - コード最適化
- `/cleanup` - リファクタリング
- `/explain` - コード理解支援

*テスト・品質*：
- `/test` - 自動テスト生成
- `/analyze` - 静的コード解析
- `/troubleshoot` - デバッグ支援
- `/reflect` - プロジェクト振り返り

*その他*：
- `/document` - 技術ドキュメント作成
- `/pm` - プロジェクト管理ワークフロー
- `/research` - "自律的・適応的・インテリジェントなWeb調査"
- `/business-panel` - マルチエキスパート戦略分析
- `/git` - Git操作
- `/workflow` - 自動化設定

**20の専門エージェント（ペルソナ）**

ドメイン専門家ペルソナ：
- **architect**：システムアーキテクチャ設計
- **frontend**：フロントエンド特化
- **backend**：バックエンド特化
- **security**：セキュリティ専門
- **analyzer**：コード解析
- **qa**：品質保証
- **performance**：パフォーマンス最適化
- **refactorer**：リファクタリング特化
- **mentor**：教育・メンタリング
- **PM Agent**：プロダクトマネジメント
- **Deep Research Agent**：深い調査
- 他9エージェント

**7つの行動モード**
- ブレインストーミング、ビジネスパネル、ディープリサーチ、オーケストレーション、トークン効率化、タスク管理、内省

**8つのMCP統合**
- Tavily（検索）、Context7（ドキュメント）、Sequential-Thinking（順序立て思考）、Serena（永続化）、Playwright（ブラウザ自動化）、Magic（UI生成）、Morphllm-Fast-Apply（コード変更）、Chrome DevTools（パフォーマンス）

---

## コミュニティのスラッシュコマンド集

### バージョン管理・Git系

**`/commit`**  
Conventionalコミット形式（絵文字付き）でコミットメッセージを自動生成。  
参考実装：[tevm-monorepo](https://github.com/evmts/tevm-monorepo)

**`/commit-fast`**  
最初の提案を自動選択し、確認をスキップ。  
参考実装：[steadystart](https://github.com/steadycursor/steadystart)

**`/create-pr`**  
Biomeフォーマットを含むPRワークフロー全体を処理。  
参考実装：[giselle](https://github.com/toyamarinyon/giselle)

**`/create-pull-request`**  
GitHub CLIとテンプレート強制でPRを作成。  
参考実装：[liam-hq](https://github.com/liam-hq/liam)

**`/fix-github-issue`**  
テスト検証つきでGitHub issueを解析・修正。  
参考実装：[kotlinter-gradle](https://github.com/jeremymailen/kotlinter-gradle)

**`/fix-pr`**  
未解決のPRコメントを取得して対応。  
参考実装：[metabase](https://github.com/metabase/metabase)

**`/create-worktrees`**  
全オープンPRのGitワークツリーを作成。  
参考実装：[tevm-monorepo](https://github.com/evmts/tevm-monorepo)

**`/analyze-issue`**  
包括的な実装仕様のためGitHubの詳細を取得。  
参考実装：[Narraitor](https://github.com/jerseycheese/Narraitor)

### コード解析・テスト系

**`/check`**  
コード品質とセキュリティの包括的チェック。  
参考実装：[slack-tools](https://github.com/rygwdn/slack-tools)

**`/tdd`**  
テスト駆動開発のRed-Green-Refactorサイクルを強制。  
参考実装：[pane](https://github.com/zscott/pane)

**`/tdd-implement`**  
テストファーストのTDDワークフロー。  
参考実装：[Narraitor](https://github.com/jerseycheese/Narraitor)

**`/optimize`**  
ボトルネックを特定して最適化ガイダンスを提供。  
参考実装：[ai-project-rules](https://github.com/to4iki/ai-project-rules)

**`/repro-issue`**  
issueの再現テストケースを作成。  
参考実装：[metabase](https://github.com/rzykov/metabase)

### コンテキスト読み込み系

**`/context-prime`**  
リポジトリ構造とプロジェクト理解をロード。  
参考実装：[elizaOS](https://github.com/elizaOS/elizaos.github.io)

**`/prime`**  
ディレクトリ可視化でプロジェクトコンテキストを初期化。  
参考実装：[AI-Engineering-Structure](https://github.com/yzyydev/AI-Engineering-Structure)

**`/load-llms-txt`**  
LLM設定ファイルをコンテキストにロード。

### ドキュメント・変更ログ系

**`/create-docs`**  
コードを解析して包括的なドキュメントを生成。  
参考実装：[Narraitor](https://github.com/jerseycheese/Narraitor)

**`/add-to-changelog`**  
変更ログの形式一貫性を維持。  
参考実装：[blockdoc-python](https://github.com/berrydev-ai/blockdoc-python)

**`/update-docs`**  
プロジェクト全体のドキュメントをレビュー・更新。

### CI・デプロイ系

**`/release`**  
変更ログとバージョン更新でリリースを管理。  
参考実装：[webdown](https://github.com/kelp/webdown)

**`/run-ci`**  
環境を有効化してCI互換チェックを実行。

### プロジェクト・タスク管理系

**`/create-plan`**  
仕様つきの製品要件ドキュメントを生成。

**`/prd-generator`**  
会話コンテキストから包括的なPRDを生成。  
参考実装：[prd-generator](https://github.com/dredozubov/prd-generator)

**`/do-issue`**  
手動レビューポイント付きでGitHub issueを実装。  
参考実装：[Narraitor](https://github.com/jerseycheese/Narraitor)

**`/todo`**  
優先度・期限付きでプロジェクトのTODOを管理。  
参考実装：[todo-slash-command](https://github.com/chrisleyva/todo-slash-command)

---

## オーケストレーションツール

### Claude Squad

**URL**：[https://github.com/smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad)

複数のエージェントを独立したワークスペースで管理するターミナルアプリ。並列開発セッションを視覚的に管理できる。

### Claude Task Master

**URL**：[https://github.com/eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master)

AIドリブン開発のタスク管理システム。PRD（製品要件ドキュメント）からタスクを自動分解し、依存関係を追跡しながら進捗を管理する。

### Ruflo

**URL**：[https://github.com/ruvnet/ruflo](https://github.com/ruvnet/ruflo)

Claude向けのリーディングエージェントオーケストレーションプラットフォーム。自己学習機能付きのマルチエージェントスワームを展開できる。エンタープライズグレードのアーキテクチャ、分散スワームインテリジェンス、RAG統合を特徴とする。

### Claude Code Flow

**URL**：[https://github.com/ruvnet/claude-code-flow](https://github.com/ruvnet/claude-code-flow)

再帰的エージェントサイクルのためのコードファーストオーケストレーション。

### Auto-Claude

**URL**：[https://github.com/AndyMik90/Auto-Claude](https://github.com/AndyMik90/Auto-Claude)

フルSDLCのためのマルチエージェントフレームワーク（かんばんUI付き）。

### Claude Swarm

**URL**：[https://github.com/parruda/claude-swarm](https://github.com/parruda/claude-swarm)

セッションをエージェントスワームに接続。

### parallel-code

**URL**：[https://github.com/johannesjo/parallel-code](https://github.com/johannesjo/parallel-code)

Claude Code、Codex、Geminiを各自のGitワークツリーで並列実行。

---

## Ralph Wiggum テクニック

### 概要

「Ralph Wiggum」テクニックは、Claude Codeを自律的なコーディングループで動かすためのフレームワーク群だ。キャラクターの名前は架空の番組「ザ・シンプソンズ」のキャラクターから取られているが、技術的には「エージェントが自己反省・自律修正を繰り返すループ」を指す。

### 主な実装

**Ralph for Claude Code**  
URL：[https://github.com/frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code)  
安全ガードレールと75以上のテスト付き自律フレームワーク。

**ralph-orchestrator**  
URL：[https://github.com/mikeyobrien/ralph-orchestrator](https://github.com/mikeyobrien/ralph-orchestrator)  
自律タスク完了のための堅牢なオーケストレーションシステム。

**ralph-wiggum-bdd**  
URL：[https://github.com/marcindulak/ralph-wiggum-bdd](https://github.com/marcindulak/ralph-wiggum-bdd)  
BashによるBDD（振る舞い駆動開発）とRalphループ統合。

**The Ralph Playbook**  
URL：[https://github.com/ClaytonFarr/ralph-playbook](https://github.com/ClaytonFarr/ralph-playbook)  
理論と実践ガイドラインを含む包括的ガイド。

---

## コミュニティフック集

### TDD Guard

**URL**：[https://github.com/nizos/tdd-guard](https://github.com/nizos/tdd-guard)

TDD原則のリアルタイム強制。テストなしのコード変更をブロックする。

### TypeScript Quality Hooks

**URL**：[https://github.com/bartolli/claude-code-typescript-hooks](https://github.com/bartolli/claude-code-typescript-hooks)

コンパイル・リント・フォーマット検証をコード変更時に自動実行。

### Dippy

**URL**：[https://github.com/ldayton/Dippy](https://github.com/ldayton/Dippy)

AST（抽象構文木）ベースの解析で安全なコマンドを自動承認。権限プロンプトを減らす。

### parry

**URL**：[https://github.com/vaporif/parry](https://github.com/vaporif/parry)

フックの入出力に対するプロンプトインジェクションスキャナー。セキュリティ強化に使う。

### cchooks

**URL**：[https://github.com/GowayLee/cchooks](https://github.com/GowayLee/cchooks)

フック統合を簡素化するPython SDK。

### CC Notify

**URL**：[https://github.com/dazuiba/CCNotify](https://github.com/dazuiba/CCNotify)

デスクトップ通知とVS Codeへのワンクリックジャンプ。

### Claudio

**URL**：[https://github.com/ctoth/claudio](https://github.com/ctoth/claudio)

シンプルなフックによるOS ネイティブサウンド通知。

---

## Plugins（プラグイン）エコシステム

### 概要

2026年初頭、AnthropicはClaude Code公式プラグインディレクトリを立ち上げ、ターミナルベースのAIコーディングアシスタントを包括的な拡張可能プラットフォームに変えた。

公式マーケットプレイス：55以上のキュレート済みプラグイン  
コミュニティエコシステム：72以上の追加プラグイン  
月間訪問者：105,000以上の開発者

プラグインはスキル・MCP サーバー・サブエージェント・フックをバンドルして配布できる。

### プラグインとスキルの使い分け

- **スキル（Markdown）**：コード生成方法をClaudeに教える。サーバー不要・API不要・依存関係なし
- **MCP サーバー（プロトコルベース）**：知識・リソース・外部ツールへのアクセスを提供。サーバープロセスが必要
- **プラグイン**：スキル・MCPサーバー・サブエージェント・フックをまとめて配布する

---

## Agent Skills オープンスタンダード

### 概要

2025年12月18日、Anthropicは「Agent Skills」をオープンスタンダードとして公開した（[agentskills.io](https://agentskills.io)）。

参考：[Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)

### クロスプラットフォーム対応

このスタンダードを採用したAIツールなら、同じスキル形式が使える：
- Claude Code
- OpenAI Codex（既に採用済み）
- Google Gemini CLI
- Cursor
- Windsurf
- その他のIDEエージェント

Claude Code向けに作ったスキルが、他のAIシステムでもそのまま動く可能性がある。

### エンタープライズ展開

中央管理・パートナーディレクトリ・オープン仕様により、成熟したエンタープライズ機能のようにスキルを展開できる。組織全体にマネージド設定でスキルを配布可能。

---

## 実践：推奨セットアップ例

### 開発者向けパーソナルスキルセット

`~/.claude/skills/` に配置するおすすめスキル：

```
~/.claude/skills/
├── code-review/       # コードレビュースキル
├── commit/            # Conventionalコミット生成
├── pr-summary/        # PRサマリー（gh CLIと組み合わせ）
├── context-prime/     # プロジェクトコンテキスト初期化
├── tdd/               # TDDワークフロー強制
└── debug-helper/      # デバッグ補助
```

### プロジェクト別サブエージェントセット

`.claude/agents/` に配置するおすすめサブエージェント：

```
.claude/agents/
├── code-reviewer.md    # 読み取り専用コードレビュー（tools: Read, Grep, Glob, Bash）
├── debugger.md         # デバッグ専門（tools: Read, Edit, Bash, Grep, Glob）
├── test-runner.md      # テスト実行・分析（tools: Bash, Read）
└── doc-writer.md       # ドキュメント生成（tools: Read, Write）
```

### コスト最適化の考え方

モデル選択のガイドライン：
- **探索・調査タスク**：`model: haiku`（高速・安価）
- **コードレビュー・品質チェック**：`model: sonnet`（バランス）
- **複雑なアーキテクチャ判断**：`model: opus`（最高性能）

---

## 最新動向・未解決問題

### 2026年前半のトレンド

**1. スキルの標準化進展**  
Agent Skills オープンスタンダードの採用が広がり、プラットフォーム間でのスキル共有エコシステムが形成されつつある。OpenAIがすでに採用しており、他の主要AIコーディングツールへの普及が期待される。

**2. エージェントチームの実験的活用**  
Agent Teamsは実験的機能だが、Cコンパイラ構築のような大規模協調タスクへの活用事例が出てきている。2026年後半に安定化・一般提供される見通し。

**3. 永続メモリの高度化**  
サブエージェントの`memory`機能により、コードベース固有の知識をセッション間で蓄積する「学習するエージェント」の実装が可能になっている。

**4. MCP統合の深化**  
モデルコンテキストプロトコル（MCP）を通じた外部ツール統合が標準化され、データベース・ブラウザ・外部API等への接続が増加。

**5. コミュニティエコシステムの急拡大**  
VoltAgentの1100以上のクロスプラットフォームスキル、hesreallyhimのawesome-claude-codeリポジトリ等、コミュニティ主導のリソースが急拡大。

### 未解決の課題

**コンテキスト管理の複雑さ**  
サブエージェントを多用すると、結果がメイン会話に蓄積してコンテキストを消費するというジレンマが残る。Agent Teamsはこれを解決しようとしているが、まだ実験段階。

**スキル発見の問題**  
スキルが増えるとdescriptionの競合・トリガー判定の難しさが生じる。`SLASH_COMMAND_TOOL_CHAR_BUDGET`環境変数で上限を上げられるが、根本的な解決策は模索中。

**セキュリティとバイパス**  
`bypassPermissions`や`dontAsk`モードのサブエージェントはセキュリティリスクを持つ。Promptインジェクション対策（`parry`等）は発展途上。

**クロスプラットフォーム互換性**  
Agent Skillsオープンスタンダードは理想的だが、実際にはClaude Code固有の拡張機能（`context: fork`、フロントマター等）が多く、完全な互換性はまだ先。

---

## 関連トピック

### Model Context Protocol（MCP）

MCPはAIツールが外部リソースに接続するためのオープン標準プロトコル。スキルがClaudeの「やり方」を教えるのに対し、MCPサーバーは「何にアクセスできるか」を拡張する。Claude Codeでは [50以上の推奨MCPサーバー](https://claudefa.st/blog/tools/mcp-extensions/best-addons) が紹介されている。

### CLAUDE.md

プロジェクトの「常識」をClaudeに覚えさせるMarkdownファイル。スキルと違い、常にコンテキストに読み込まれる（スキルはdescriptionのみ）。コーディング規約・技術スタック・プロジェクト構造等を記述する。

### ワークツリー並列実行

Gitワークツリーで複数のClaudeセッションを並列実行する手法。`/batch`や`isolation: worktree`で自動化される。[parallel-code](https://github.com/johannesjo/parallel-code)等のツールでClaude Code・Codex・Geminiの並列実行も可能。

### Headless Mode

`claude --headless` でCI/CDパイプラインにClaude Codeを統合。GithubActions等のAutomationでスキル・サブエージェントを活用できる。Agent SDKと組み合わせると本格的なAIドリブンCIが構築可能。

---

## 参考リンク

### 公式ドキュメント

- [Claude Code Skills公式ドキュメント](https://code.claude.com/docs/en/skills)
- [Claude Code Subagents公式ドキュメント](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Agent Teams公式ドキュメント](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Hooks公式ガイド](https://code.claude.com/docs/en/hooks-guide)
- [Claude Code コマンドリファレンス](https://code.claude.com/docs/en/commands)
- [Anthropic公式ドキュメント](https://docs.claude.com/en/home)
- [Anthropic公式Skillsリポジトリ](https://github.com/anthropics/skills)
- [Claude API Agent SDK概要](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent Skills APIドキュメント](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)

### コミュニティリソース

- [awesome-claude-code（hesreallyhim）](https://github.com/hesreallyhim/awesome-claude-code)
- [awesome-claude-code スラッシュコマンド集](https://github.com/hesreallyhim/awesome-claude-code/tree/main/resources/slash-commands)
- [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents)
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)

### フレームワーク・ツール

- [SuperClaude Framework（GitHub）](https://github.com/SuperClaude-Org/SuperClaude_Framework)
- [claudekit（GitHub）](https://github.com/carlrannaberg/claudekit)
- [Claude Task Master（GitHub）](https://github.com/eyaltoledano/claude-task-master)
- [Claude Squad（GitHub）](https://github.com/smtg-ai/claude-squad)
- [Claude Swarm（GitHub）](https://github.com/parruda/claude-swarm)
- [Ruflo（GitHub）](https://github.com/ruvnet/ruflo)
- [Auto-Claude（GitHub）](https://github.com/AndyMik90/Auto-Claude)

### セキュリティ・品質

- [Trail of Bits Security Skills（GitHub）](https://github.com/trailofbits/skills)
- [TDD Guard（GitHub）](https://github.com/nizos/tdd-guard)
- [parry（GitHub）](https://github.com/vaporif/parry)
- [Dippy（GitHub）](https://github.com/ldayton/Dippy)

### 記事・ブログ

- [Essential Claude Code Skills and Commands](https://batsov.com/articles/2026/03/11/essential-claude-code-skills-and-commands/)
- [Equipping agents for the real world with Agent Skills (Anthropic)](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Code Customization Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [/simplify and /batch Commands Guide](https://claudefa.st/blog/guide/mechanics/simplify-batch-commands)
- [Best practices for Claude Code subagents（PubNub）](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/)
- [Compare Agentic CLI Tools](https://getstream.io/blog/agentic-cli-tools/)
- [100+ Claude Code Subagent Collection（DEV.to）](https://dev.to/voltagent/100-claude-code-subagent-collection-1eb0)
- [Our Claude Code Setup: 30 Skills, MCPs, and Self-Learning Hooks](https://dev.to/axitslab/our-claude-code-setup-30-skills-mcps-and-self-learning-hooks-5gje)

---

*本レポートはポッドキャスト台本生成用の素材として作成（2026年4月22日）。情報は調査時点のものであり、急速に変化するエコシステムのため最新情報は各公式ドキュメントを参照のこと。*
