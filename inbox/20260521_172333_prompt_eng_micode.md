# AI指示・プロンプト原則調査シリーズ: micode におけるプロンプトエンジニアリング

## 1. 概要

[micode](https://github.com/vtemian/micode) は [OpenCode](https://github.com/sst/opencode) 向けの npm プラグインで、**Brainstorm → Plan → Implement** という構造化ワークフローをエージェント群とフックで強制する OSS である。398 stars 規模のプロジェクトで、oh-my-opencode 等の先行プラグインを参考にしつつ、HumanLayer ACE-FCA や Factory.ai のコンテキスト圧縮研究からも着想を得ている。

プロンプト設計の中心思想は **「役割分離されたマルチエージェント + XML 構造化システムプロンプト + ランタイム注入」** である。

特徴的なアプローチ:

- **13 エージェントの役割特化**: commander / brainstormer / planner / executor / implementer / reviewer 等、各フェーズに専用プロンプト
- **XML タグによる構造化**: `<environment>`, `<identity>`, `<critical-rules>`, `<process>` 等で LLM 向けに機械可読な指示
- **温度 (temperature) のフェーズ別チューニング**: brainstormer 0.7、planner 0.3、implementer 0.1 など
- **Primary / Subagent モード分離**: primary は Task ツール、subagent は spawn_agent ツール（混同禁止を `<environment>` で明示）
- **Mindmodel システム**: `.mindmodel/` にプロジェクト固有パターンを生成し、implementer / reviewer / commander が `mindmodel_lookup` で参照
- **Continuity Ledger**: セッション状態を `thoughts/ledgers/CONTINUITY_*.md` に構造化保存し、次セッションで system prompt に注入
- **フックによる動的注入**: ARCHITECTURE.md / CODE_STYLE.md、ledger、mindmodel 例、コンテキスト圧縮

micode は「1 つの万能 system prompt」ではなく、**TypeScript の `AgentConfig.prompt` 文字列 + フック注入 + ユーザー fragments** の三層でプロンプトを管理する。これは TDD 駆動・高並列マイクロタスク実行を前提とした、実装志向のエージェント設計である。

## 2. システム指示 (System Instructions) の分析

### 2.1 エージェント階層とモード

| エージェント | mode | temperature | 役割 |
|-------------|------|-------------|------|
| commander | primary | (default) | 全体オーケストレーション、quick-mode 判定 |
| brainstormer | primary | 0.7 | 設計探索、ユーザー対話 |
| planner | subagent | 0.3 | 設計→マイクロタスク計画 |
| executor | subagent | 0.2 | バッチ並列実行の指揮 |
| implementer | subagent | 0.1 | 1 ファイル + 1 テストの実装 |
| reviewer | subagent | 0.3 | 1 マイクロタスクのレビュー |
| codebase-locator | subagent | 0.1 | ファイル位置の特定のみ |
| codebase-analyzer | subagent | 0.2 | コード動作の説明（改善提案禁止） |
| pattern-finder | subagent | 0.2 | 既存パターンの concrete example 提示 |
| ledger-creator | subagent | 0.2 | セッション continuity ledger 生成 |
| mm-orchestrator | subagent | 0.2 | mindmodel v2 生成パイプライン |

全エージェントのプロンプト先頭に共通の `<environment>` ブロックがある:

```xml
<environment>
You are running as part of the "micode" OpenCode plugin (NOT Claude Code).
OpenCode is a different platform with its own agent system.
Available micode agents: commander, brainstormer, planner, ...
Use Task tool with subagent_type matching these agent names to spawn them.
</environment>
```

**設計意図**: Claude Code / Cursor 等の他プラットフォーム知識による誤動作を防ぎ、利用可能な subagent 名と正しい spawn API（Task vs spawn_agent）を明示する。

### 2.2 ペルソナ設計: 「シニアエンジニア」アイデンティティ

micode の primary エージェント（commander, brainstormer）は共通して **「承認を求めるジュニア」ではなく「決断するシニアエンジニア」** をペルソナとする。

brainstormer の `<identity>`:

- Make decisions. Don't ask "what do you think?" - state "I'm doing X because Y."
- State assumptions and proceed. User will correct you if wrong.
- When you see a problem, propose a solution.

commander の `<relationship>` はより人間的:

- We're colleagues. No hierarchy.
- Don't glaze. No sycophancy. Never say "You're absolutely right!"
- Push back when you disagree.
- If uncomfortable pushing back, say "Strange things are afoot at the Circle K"（ユーモアによる緊張緩和）

**価値観の明示** (`<values>`):

- Honesty. If you lie, you'll be replaced.
- Do it right, not fast. Never skip steps or take shortcuts.
- Tedious, systematic work is often correct.

これは Anthropic の「helpful assistant」デフォルトを意図的に上書きし、**同僚としての率直さと手順遵守** を優先する設計である。

### 2.3 Commander の quick-mode（タスク粒度によるプロンプト分岐）

commander はプロンプト内の `<quick-mode>` で **ワークフロー省略の decision tree** を持つ:

```
0. Call mindmodel_lookup for project patterns → ALWAYS, before ANY code
1. Can I do this in under 2 minutes with obvious correctness? → Just do it
2. Can I hold the whole change in my head? → Brief plan, then execute
3. Multiple unknowns or significant scope? → Full workflow
```

| カテゴリ | 例 | 動作 |
|---------|-----|------|
| trivial | typo 修正、import 追加 | 即実行 |
| small | 20 行未満の関数追加 | 頭の中で計画→実行 |
| complex | 5+ ファイル、新機能 | brainstorm → plan → execute |

**学び**: 全タスクに同一ワークフローを適用せず、プロンプト内 decision tree で ceremony を制御する。

### 2.4 Brainstormer の voice-and-tone と formatting-rules

brainstormer は `<voice-and-tone>` と `<formatting-rules priority="HIGH">` で出力品質を厳密に指定:

- Write like you're explaining to a smart peer over coffee
- USE MARKDOWN FORMATTING - headers, bullets, bold, whitespace
- NEVER write walls of text

`<good-example>` / `<bad-example>` による **対比 Few-shot** が含まれ、望ましい Markdown 出力の具体例を示す。bad example は「1 段落の壁テキスト」を明示的に禁止例として提示。

### 2.5 Analysis エージェントの「観察者」ペルソナ

codebase-locator / codebase-analyzer / pattern-finder は **分析と提案の分離** を徹底:

| エージェント | やること | やらないこと |
|-------------|---------|-------------|
| codebase-locator | ファイルパスを返す | 内容分析、改善提案 |
| codebase-analyzer | file:line 付きで HOW を説明 | 品質評価、改善提案 |
| pattern-finder | 2-3 の concrete code example | 抽象的な説明のみ |

tools 設定で `write: false`, `edit: false`, `bash: false`, `task: false` を付与し、**プロンプト + ツール制限の二重 enforcement** を行う。

### 2.6 Reviewer の actionable review

reviewer は「問題を報告するだけ」ではなく **fix 付きレビュー** を要求:

- For every issue, suggest a concrete fix
- Don't just say "this is wrong" - say "this is wrong, fix by doing X"
- Provide code snippets for non-trivial fixes

`<checklist>` は correctness / completeness / style / safety の 4 セクションに分類され、優先順位（Critical issues first, style last）も明示。

## 3. 採用されているプロンプトテクニック

### 3.1 XML タグによる構造化 System Prompt

全エージェントが HTML/XML 風タグでセクション分割:

```xml
<purpose>...</purpose>
<identity>...</identity>
<critical-rules>
  <rule priority="HIGHEST">...</rule>
</critical-rules>
<process>
  <phase name="understanding">...</phase>
</process>
<never-do>
  <forbidden>...</forbidden>
</never-do>
```

**利点**: LLM がセクション境界を認識しやすく、priority 属性で競合ルールの優先度を表現できる。OpenClaw や Claude の XML タグ推奨パターンと一致。

### 3.2 Phase-based Process（ステップバイステップ指示）

brainstormer の `<process>` は 6 フェーズ:

1. understanding — 即座に subagent を並列 spawn
2. exploring — 2-3 アプローチ提示、リード案を明示
3. presenting — 全セクションを 1 メッセージで提示
4. finalizing — design doc 作成 → planner 自動 spawn
5. handoff — planner 完了後 executor 自動 spawn
6. execution — 完了報告のみ、コード禁止

**workflow-autonomy 原則**: 「Ready for planner?」等の確認を禁止し、ユーザーが brainstorm を開始した時点で全パイプライン承認済みとみなす。

### 3.3 Few-shot（good/bad example）

brainstormer の formatting-rules に good-example / bad-example ペアがある。pattern-finder は output-format テンプレート内に code snippet プレースホルダを含む。

### 3.4 対比による禁止事項（never-do / forbidden）

`<never-do>` / `<forbidden>` タグで **ネガティブ制約** を列挙:

- NEVER ask "Does this look right?"
- NEVER write code snippets or examples（brainstormer）
- NEVER use spawn_agent（primary エージェント向け）

positve instruction だけでは防げない failure mode を、明示的 forbidden list で補完。

### 3.5 Gap-filling（planner の設計穴埋め）

planner の `<gap-filling>` は design doc に未記載の実装詳細を **エージェント自身が決断** するよう指示:

```xml
<gap situation="Design says 'add validation' but no rules">
  Decision: Implement sensible defaults
  Document: "Design requires validation. Implementing: [list rules]"
</gap>
```

「design doesn't specify」と報告することを `<rule>` で禁止。WHAT/WHOW の責務分離をプロンプトレベルで enforce。

### 3.6 Adaptation over Escalation（implementer）

implementer は plan と reality の不一致時に **適応を優先**:

- File at different path → Glob で探して proceed
- Function signature slightly different → 実装を調整
- Fundamental architectural mismatch のみ escalate

これにより micro-task 並列実行時の false-positive 停止を減らす。

### 3.7 Fire-and-check 並列パターン（executor）

executor プロンプトは **batch-first parallelism** を明示:

- 1 batch 内の全 implementer を 1 メッセージで spawn（10-20 並列）
- 完了後、全 reviewer を 1 メッセージで spawn
- max 3 implementer-reviewer cycles per task

spawn_agent API の使用例を `<invocation>` 内に埋め込み、具体的な呼び出し形式を Few-shot 提供。

### 3.8 TDD 構造の強制

planner / implementer 双方で TDD を enforce:

- failing test → verify fail → implement → verify pass
- Every code example MUST be complete - never write "add validation here"

### 3.9 Mindmodel 2-phase pipeline（mm-orchestrator）

mindmodel 生成は 7 並列分析 → 1 組立の 2 フェーズ:

```
Phase 1: mm-stack-detector, mm-dependency-mapper, ... (7 agents parallel)
Phase 2: mm-constraint-writer (assembles .mindmodel/)
```

`<spawn_agent-api>` に **配列形式の並列 spawn 例** を含む。`<progress-output>` でユーザー向けステータスメッセージの出力を CRITICAL とマーク。

### 3.10 Continuity Ledger（構造化セッション要約）

ledger-creator は固定 `<ledger-format>` テンプレートを出力:

- Goal / Constraints / Progress (Done/In Progress/Blocked)
- Key Decisions / Next Steps
- File Operations (Read/Modified)
- Working Set (branch, key files)

`<iterative-update-rules>` で **情報の欠落禁止**（PRESERVE all existing information）を enforce。

## 4. プロンプト作成の原則・ガイドライン

### 4.1 リポジトリ内 CLAUDE.md（開発者向け、エージェント向けではない）

micode 自身の `CLAUDE.md` は **プラグイン開発者** 向けコーディング規約:

- No classes for business logic → factory functions
- Max function length: 40 lines
- No `any` types, Valibot for validation
- Never use em dashes in writing
- Test real behavior, not mocked behavior

エージェントプロンプトとは別レイヤーだが、mindmodel 生成の入力品質に影響する。

### 4.2 AgentConfig as Pure Data

`src/agents/` の各ファイルは **純粋な設定オブジェクト**（logic なし）:

```typescript
export const brainstormerAgent: AgentConfig = {
  description: "...",
  mode: "primary",
  temperature: 0.7,
  tools: { spawn_agent: false },
  prompt: `<environment>...</environment>...`,
};
```

プロンプト文字列は TypeScript テンプレートリテラル内の XML。メンテナンスはファイル単位で分離。

### 4.3 ツール制限による capability gating

reviewer 例:

```typescript
tools: {
  write: false,
  edit: false,
  task: false,
}
```

プロンプトで「書き込み禁止」と言うだけでなく、AgentConfig.tools で **物理的にツールを無効化**。ソフト guidance と hard enforcement の分離（OpenClaw の Safety 設計と同型）。

### 4.4 micode.json fragments（ユーザー拡張）

`~/.config/opencode/micode.json` で per-agent prompt fragments を追加可能:

```jsonc
{
  "fragments": {
    "commander": ["custom-instructions.md"]
  }
}
```

config-loader が fragments を merge。コアプロンプトを fork せずにユーザー指示を注入できる。

### 4.5 命名・配置規約

| 種類 | 配置 |
|------|------|
| エージェントプロンプト | `src/agents/{name}.ts` の `prompt` フィールド |
| OpenCode 追加エージェント | `.opencode/agent/*.md` (YAML frontmatter) |
| プロジェクト制約 | `.mindmodel/**/*.md` + `manifest.yaml` |
| 設計/計画成果物 | `thoughts/shared/designs/`, `thoughts/shared/plans/` |
| セッション ledger | `thoughts/ledgers/CONTINUITY_{session}.md` |
| プロジェクトコンテキスト | `ARCHITECTURE.md`, `CODE_STYLE.md`（/init で生成） |

### 4.6 Primary vs Subagent の API 規約

| mode | spawn 方法 | 禁止 |
|------|-----------|------|
| primary (commander, brainstormer) | Task tool + subagent_type | spawn_agent |
| subagent (planner, executor, ...) | spawn_agent tool | Task tool |

`<environment>` と `<critical-rules>` の両方で繰り返し禁止。混同は multi-agent システムで頻出する failure mode。

## 5. 動的プロンプトとコンテキスト管理

### 5.1 Context Injector Hook

`src/hooks/context-injector.ts`:

- **chat.params**: プロジェクトルートの `ARCHITECTURE.md`, `CODE_STYLE.md` 等を `<project-context>` ブロックとして system prompt に追加
- **tool.execute.after**: Read/Edit 時、ファイル所在ディレクトリを遡り `<directory-context>` を tool output に追記

```typescript
function formatContextBlock(files: Map<string, string>, label: string): string {
  // ...
  blocks.push(`<context file="${filename}">\n${content}\n</context>`);
  return `\n<${label}>\n${blocks.join("\n\n")}\n</${label}>\n`;
}
```

**設計**: 全ファイルを常時 system prompt に載せず、**アクセスしたディレクトリに関連する context のみ** 遅延注入。TTL キャッシュ付き。

### 5.2 Ledger Loader Hook

`src/hooks/ledger-loader.ts`:

- `thoughts/ledgers/CONTINUITY_*.md` の最新ファイルを検出
- system prompt 先頭に `<continuity-ledger session="...">` として注入
- 付随メッセージ: "You are resuming work from a previous context clear."

Factory.ai の structured compaction 研究に触れつつ、micode は **LLM 生成の構造化 ledger** でセッション跨ぎを実現。

### 5.3 Auto-Compact Hook

`src/hooks/auto-compact.ts`:

- コンテキスト使用率が `compactionThreshold`（デフォルト 0.5 = 50%）を超えると自動 compaction トリガー
- modelContextLimits から provider/model 別の context window を参照
- summary メッセージ検出で compaction 完了を待機

プロンプトではなく **イベント駆動のインフラ** で長セッションを支える。

### 5.4 Mindmodel Injector Hook

`src/hooks/mindmodel-injector.ts`:

- ユーザーの最新メッセージから task 文字列を抽出
- `matchCategories(task, manifest)` で関連カテゴリを特定
- 該当する code examples を `<mindmodel-examples>` として注入
- LRU キャッシュ（2000 entries）で同一 task の再計算を回避

implementer / reviewer プロンプトは `mindmodel_lookup` ツール呼び出しを **MUST** とするが、hook は能動的に relevant examples を先回り注入。

### 5.5 Mindmodel Lookup Tool（能動的クエリ）

commander の decision tree step 0: `mindmodel_lookup` → ALWAYS before ANY code。

implementer / reviewer は `<project-constraints priority="critical">` で:

```xml
<rule>YOU MUST call mindmodel_lookup BEFORE adapting ANY code</rule>
<query purpose="adapting code">mindmodel_lookup("component patterns")</query>
```

**二段構え**: hook による passive injection + ツールによる active lookup。

### 5.6 変数埋め込みと成果物パス

プロンプト内の動的部分は主に **パス規約とプレースホルダ** で表現:

- `thoughts/shared/designs/YYYY-MM-DD-{topic}-design.md`
- `thoughts/shared/plans/YYYY-MM-DD-{topic}.md`
- `thoughts/ledgers/CONTINUITY_{session-name}.md`

ledger-creator の update 時は `<previous-ledger>`, `<file-operations>` タグで structured input format を定義。executor → implementer 間は prompt 引数に complete code を含める **copy-paste ready** 形式。

### 5.7 Per-agent Model / Thinking 設定

micode.json で agent 別 override:

```jsonc
{
  "agents": {
    "commander": {
      "thinking": { "type": "enabled", "budgetTokens": 100000 }
    }
  }
}
```

プロンプト本文とは独立に、モデル・reasoning budget を runtime 設定。解決優先度: micode.json per-agent > opencode.json default > plugin default。

## 6. まとめと学び

### 6.1 micode から学べるベストプラクティス

1. **役割ごとにプロンプトを分割し、混同禁止を environment ブロックで統一する**  
   13 エージェントでも、先頭 `<environment>` + mode 別 spawn API 規約で一貫性を保つ。

2. **XML 構造化 + priority 属性 + phase-based process**  
   長大な system prompt をセクション化し、フェーズ遷移条件（trigger 属性）までプロンプト内に記述。

3. **good/bad example と never-do リストの併用**  
   望ましい出力形式を positive + negative の両面から固定。

4. **プロンプト + ツール制限の二重 enforcement**  
   reviewer に write/edit を禁止、analysis エージェントに bash を禁止。

5. **Temperature を創造性/決定論のトレードオフに合わせる**  
   設計 0.7、計画 0.3、実装 0.1。

6. **Quick-mode decision tree で ceremony を可変に**  
   全タスクに同一ワークフローを強制しない。

7. **Adaptation over Escalation**  
   並列 micro-task 実行では、軽微な不一致での停止より適応を優先。

8. **Structured ledger + hook injection でセッション continuity**  
   非構造チャット履歴に頼らず、Goal/Progress/Decisions の固定スキーマで状態を保持。

9. **Mindmodel: プロジェクト固有パターンの生成と lookup**  
   汎用コーディング規約を `.mindmodel/` に落とし、implement/review 時に参照させる。

10. **fragments によるユーザー拡張**  
    コアプロンプトを fork せず micode.json で追記可能に。

### 6.2 oh-my-opencode との哲学比較（README より）

| 観点 | micode | oh-my-opencode |
|------|--------|----------------|
| ワークフロー | brainstorm→plan→implement 固定 | キーワード駆動、柔軟 |
| 並列性 | 10-20 micro-task 同時 | background task + tmux |
| コンテキスト回復 | Ledger (CONTINUITY files) | AGENTS.md 階層 |
| 設定量 |  focused | 34 hooks, 11 agents |

micode は ** opinionated workflow** をプロンプト設計そのもので enforce する。柔軟性より **手順と検証の再現性** を優先する設計思想。

### 6.3 自作エージェントへの転用示唆

- Brainstormer の `<confirmation-protocol>` は「いつ止まり、いつ進むか」の state machine として再利用価値が高い
- Planner の `<gap-filling>` は spec が不完全な現場で agent の停滞を防ぐ
- Executor の batch-first pattern は subagent 並列上限をプロンプト例で teach する好例
- Ledger format は任意の long-running agent に session handoff スキーマとして転用可能

## 参考リンク・プロンプト定義場所

### リポジトリ

- https://github.com/vtemian/micode
- https://www.npmjs.com/package/micode

### 主要プロンプト定義（src/agents/）

| ファイル | エージェント |
|---------|-------------|
| https://github.com/vtemian/micode/blob/main/src/agents/commander.ts | commander |
| https://github.com/vtemian/micode/blob/main/src/agents/brainstormer.ts | brainstormer |
| https://github.com/vtemian/micode/blob/main/src/agents/planner.ts | planner |
| https://github.com/vtemian/micode/blob/main/src/agents/executor.ts | executor |
| https://github.com/vtemian/micode/blob/main/src/agents/implementer.ts | implementer |
| https://github.com/vtemian/micode/blob/main/src/agents/reviewer.ts | reviewer |
| https://github.com/vtemian/micode/blob/main/src/agents/codebase-locator.ts | codebase-locator |
| https://github.com/vtemian/micode/blob/main/src/agents/codebase-analyzer.ts | codebase-analyzer |
| https://github.com/vtemian/micode/blob/main/src/agents/pattern-finder.ts | pattern-finder |
| https://github.com/vtemian/micode/blob/main/src/agents/ledger-creator.ts | ledger-creator |
| https://github.com/vtemian/micode/blob/main/src/agents/mindmodel/orchestrator.ts | mm-orchestrator |
| https://github.com/vtemian/micode/blob/main/src/agents/mindmodel/constraint-writer.ts | mm-constraint-writer |

### フック（動的注入）

| ファイル | 役割 |
|---------|------|
| https://github.com/vtemian/micode/blob/main/src/hooks/context-injector.ts | ARCHITECTURE.md 等の注入 |
| https://github.com/vtemian/micode/blob/main/src/hooks/ledger-loader.ts | Continuity ledger 注入 |
| https://github.com/vtemian/micode/blob/main/src/hooks/auto-compact.ts | コンテキスト自動圧縮 |
| https://github.com/vtemian/micode/blob/main/src/hooks/mindmodel-injector.ts | Mindmodel examples 注入 |

### 設定・拡張

| ファイル | 役割 |
|---------|------|
| https://github.com/vtemian/micode/blob/main/src/config-loader.ts | micode.json / fragments merge |
| https://github.com/vtemian/micode/blob/main/CLAUDE.md | プラグイン開発規約 |
| https://github.com/vtemian/micode/blob/main/.opencode/agent/deployer.md | deployer subagent (Markdown prompt) |

### インスピレーション（README 記載）

- https://github.com/code-yeongyu/oh-my-opencode — Plugin architecture
- https://github.com/humanlayer/12-factor-agents — Structured workflows (ACE-FCA)
- https://factory.ai/blog/context-compression — Structured compaction research
