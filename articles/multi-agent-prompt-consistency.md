# マルチエージェント・スキル間のプロンプト一貫性管理

**調査日**: 2026-06-02  
**調査範囲**: マルチエージェントLLMシステムにおけるプロンプトの重複・矛盾防止、バージョン管理、Claude Code固有のパターン

---

## エグゼクティブサマリー

複数エージェント・スキルにまたがるプロンプトの重複・矛盾問題は、「プロンプトをコードと同等の一等市民として扱う」設計哲学で解決できる。核心は **3層の階層分離 × Single Source of Truth × CI/CDゲート** の構造にある。

最も即効性が高い対策は**2つ**:
1. CLAUDE.mdをポリシー宣言専用に短く保ち、詳細をスキルに委譲する
2. スキルはCLAUDE.mdを「override」ではなく「extend（拡張）」として書く

---

## 1. 問題の本質：なぜ矛盾・重複が起きるか

| 原因 | メカニズム |
|---|---|
| コピー&ペースト増殖 | 同じ文言を複数スキルに手書きで複製し、個別に進化する |
| 責任範囲の曖昧さ | どのエージェントが何を決定するか未定義のまま指示が重なる |
| プロンプトドリフト | 上流を修正したが下流スキルを更新し忘れる |
| コンテキスト注入の衝突 | スキル本文がCLAUDE.mdと矛盾する主張をする |
| CLAUDE.md肥大化 | 長すぎてルールが埋もれ、Claudeが従わなくなる |

> **実例**: 本番システムで3単語を変更したプロンプトがJSONパース失敗率を40%上昇させた事例あり（Agenta, 2025）。上流変更の下流波及（カスケード故障）は多エージェントシステム固有のリスク。

---

## 2. 解決アーキテクチャ：3層プロンプト構造

主要フレームワーク（Claude Code、OpenAI Agents SDK、CrewAI、Google ADK）で共通して採用されている構造：

```
┌──────────────────────────────────────────────────────┐
│  Layer 1: グローバル/システム層（全エージェント共通）    │
│  - 出力フォーマット規則                                 │
│  - セーフティガードレール・禁止事項                     │
│  - 引用・ログ・コード規約                              │
│  - アーキテクチャ上の決定事項                          │
│  → Claude Codeでは: CLAUDE.md                        │
└────────────────┬─────────────────────────────────────┘
                 │ 自動注入（全カスタムエージェントに）
     ┌───────────┼──────────────────┐
     ▼           ▼                  ▼
┌─────────┐ ┌─────────────┐ ┌─────────────┐
│ Layer 2 │ │   Layer 2   │ │   Layer 2   │
│Agent A  │ │  Skill B    │ │  Skill C    │
│固有層   │ │  固有層     │ │  固有層     │
│- 役割   │ │- 役割       │ │- 役割       │
│- スコープ│ │- スコープ   │ │- スコープ   │
│- 拡張のみ│ │- 拡張のみ   │ │- 拡張のみ   │
└─────────┘ └─────────────┘ └─────────────┘
                 │
     ┌───────────┘
     ▼
┌─────────────────────────────────────┐
│  Layer 3: タスク/呼び出し層          │
│  - ユーザーの実際のリクエスト         │
│  - オーケストレーターの委任メッセージ  │
│  → Claude Codeでは: 実際の会話内容  │
└─────────────────────────────────────┘
```

**シャープバウンダリ原則**: 各エージェント/スキルが「触れてよいもの」「触れてはいけないもの」を明示することが、干渉防止の最も重要な実践（Medium: Oz Ben, 2024）。

---

## 3. Claude Code固有の動作（公式ドキュメント確認済み）

### CLAUDE.mdの実際の伝播動作

```
CLAUDE.md → 全カスタムサブエージェントに自動注入 ✓
CLAUDE.md → Explore/Planビルトインエージェントには注入されない ✗
スキル(SKILL.md) → 呼び出し時のみロード（毎セッションではない）
```

### CLAUDE.mdに書くべきこと vs. 書かないこと（公式ガイドライン）

| ✅ 書く | ❌ 書かない |
|---|---|
| Claudeが推測できないコマンド | コードを読めば分かること |
| デフォルトと異なるコードスタイル | 標準的な言語慣習 |
| テスト手順・ブランチ規約 | 頻繁に変わる情報 |
| アーキテクチャ上の決定事項 | 長い説明・チュートリアル |
| 非自明な注意事項（gotchas） | 「クリーンなコードを書け」等の自明な慣習 |

**重要な経験則**: 「ルールがあるのにClaudeが従わない場合、CLAUDE.mdが長すぎてルールが埋もれている」（公式ドキュメント）

### HooksとCLAUDE.mdの違い

| 手段 | 特性 | 用途 |
|---|---|---|
| **Hooks** (`settings.json`) | 決定論的・必ず実行 | 絶対守らせたいルール（セキュリティレビュー等） |
| **CLAUDE.md** | アドバイザリー・推奨 | ガイドライン・コンテキスト情報 |

→ セキュリティチェックのような絶対ルールはHooksで実装する。

### スキル設計のルール（公式）

- `SKILL.md`は500行以内を推奨
- CLAUDE.mdの内容を繰り返さない（矛盾回避のため）
- 「CLAUDE.mdの拡張」として書く（overrideしない）
- サイドエフェクトがあるワークフロー（deploy, commit等）は`disable-model-invocation: true`

### サブエージェントのdescriptionフィールドの重要性

**descriptionはルーティングのAPI**。オーケストレーターはdescriptionを読んで委任先を決定する（フルのsystem promptは読まない）。短く・明確に書くことが必須。

---

## 4. Single Source of Truth（SSoT）の実装

### プロンプトレジストリパターン

```
アンチパターン:
  コードベース内にハードコードされたプロンプト文字列
  → 各エージェントリポジトリで独立進化 → ドリフト発生

推奨パターン:
  プロンプトレジストリ（中央管理）
    v1.0.0 (immutable)
    v1.1.0 (immutable)  ← エイリアス: production
    v2.0.0 (immutable)  ← エイリアス: staging

  各エージェントは実行時にエイリアス名でフェッチ
  → エイリアス付け替えだけで全エージェントが更新
  → コード変更ゼロ
```

### 主要ツール比較

| ツール | 特徴 | 推奨用途 |
|---|---|---|
| **Langfuse** | エイリアス管理、MCPサーバーあり、OSS | Claude Codeとの直接連携が可能 |
| **MLflow Prompt Registry** | Git同様のイミュータブル版、Databricks統合 | エンタープライズ・チーム開発 |
| **PromptLayer** | ノンエンジニア向けUI、ライン差分比較 | PM・ドメイン専門家が編集する場合 |
| **Promptfoo** | OSS・CLI完結・GitHub Actions統合 | CI/CDゲートの実装 |
| **DSPy** | 宣言的シグネチャ・自動最適化 | プロンプトをPythonコードとして管理 |

---

## 5. バージョン管理・CI/CD統合

### プロンプトCI/CDパイプライン

```
Edit（管理UI or テキストエディタ）
  ↓
Version（不変スナップショット + SHA）
  ↓
Test（ゴールデンデータセット評価）
  ↓
Review（差分 + スコア比較のPR）
  ↓
Deploy（staging→productionエイリアス昇格）
  ↓
Monitor（バージョンIDで全出力をトレース）
```

### CI評価ゲートの種類

| ゲート | 内容 |
|---|---|
| Exact match | JSONスキーマ・必須フィールドの存在確認 |
| LLM-as-judge | 品質スコア（忠実性・関連性・幻覚率） |
| Regression diff | 現行productionとの定量比較・閾値割れでマージブロック |
| Red team | 敵対的入力・ジェイルブレーク耐性テスト |

**Promptfooを使ったGitHub Actions統合例**:

```yaml
# .github/workflows/prompt-check.yml
- name: Run prompt consistency tests
  uses: promptfoo/promptfoo-action@v2
  with:
    config: .promptfoorc.yaml
```

```yaml
# .promptfoorc.yaml
prompts:
  - file://CLAUDE.md
  - file://.claude/skills/security-review.md
tests:
  - vars:
      task: "create migration"
    assert:
      - type: llm-rubric
        value: "Response must include RLS policy creation"
```

### Gitだけでのプロンプト管理の限界

- ノンエンジニアが参加できない
- プレイグラウンドでの編集がGitに自動同期されない
- プロンプト文字列のdiffに意味的な解釈が難しい

**補完策**: WebhookでGit↔管理UI間を同期、またはDSPyのようにプロンプトをPythonコードとして扱いGitで完結させる。

---

## 6. フレームワーク別の階層設計パターン比較

| フレームワーク | グローバル層 | エージェント固有層 | タスク層 |
|---|---|---|---|
| **Claude Code** | CLAUDE.md | `.claude/agents/*.md`のbody | 委任メッセージ |
| **OpenAI Agents SDK** | `RECOMMENDED_PROMPT_PREFIX` | `Agent.instructions` | 会話ターン |
| **CrewAI** | 暗黙（タスク出力チェーン） | `role` + `goal` + `backstory` | `Task.description` |
| **LangGraph** | `State`オブジェクト（共有状態） | ノード関数内のシステムプロンプト | ノード呼び出し引数 |
| **Google ADK** | `static_instruction`（不変） | テンプレート変数 `{variable}` | `include_contents`で制御 |

**Google ADKの特徴的なパターン**: ハンドオフ時に前エージェントの出力を「ナラティブコンテキスト」として再フレーミングし、新エージェントが役割混乱しないようにする。

---

## 7. プロンプト感度の増幅効果（学術研究より）

arXiv Mass Framework（2502.02533）の知見：

```
単独エージェント: 小さな変更 → 小さな性能変化
多エージェント連鎖: 小さな変更 → 変化が乗算されて増幅

最適化アプローチ（3段階）:
  Stage 1: 各エージェントのプロンプトを独立に最適化
  Stage 2: エージェントトポロジー（接続構造）を選択
  Stage 3: システム全体を結合最適化

→ 非階層的ベースラインと比較して14〜19%ポイントの性能向上
```

---

## 8. Anthropic公式推奨：サブエージェント委任の4要素

```markdown
# 委任プロンプトに必ず含める4要素
1. Objective（目的）: 何を達成するか具体的に
2. Output format（出力形式）: 結果をどう構造化するか
3. Tool guidance（ツール指針）: どのツール・情報源を使うか
4. Task boundaries（タスク境界）: 何を変更してはいけないか
```

「'半導体不足を調査して'のような短い指示が重複作業・誤解釈を引き起こした」（Anthropic Engineering Blog）。

---

## 9. 実装ロードマップ（推奨順序）

### Phase 1（即時実施・ツール不要）: 構造分離

```
Before:
  CLAUDE.md → アーキテクチャ詳細 + コマンド + RLS手順 + スタイル規約（長大）

After:
  CLAUDE.md → ポリシー宣言 + コマンド一覧のみ（短く保つ）
  .claude/skills/security-review.md → RLS/セキュリティ手順の詳細
  .claude/skills/db-migration.md → マイグレーション手順の詳細
  settings.json hooks → 必須チェック（自動実行・決定論的）
```

**スキル書き方の原則**:
```markdown
# NG: CLAUDE.mdの内容を繰り返す
RLSは必ずENABLE ROW LEVEL SECURITYで有効化する。
processing_logsパターンでポリシーを追加する。

# OK: CLAUDE.mdを前提として拡張のみ書く
このスキルはCLAUDE.mdのマイグレーション規約を前提とします。
追加で以下のチェックを実行します：[スキル固有の内容のみ]
```

### Phase 2（短期・ドキュメント整備）: インデックス化

```markdown
# docs/prompt-index.md
| スキル/コマンド | 責任範囲 | 使わない場面 |
|---|---|---|
| /security-review | RLS・インジェクション確認 | 非DBコード変更時 |
| /db-migration | マイグレーション作成 | - |
```

CLAUDE.md変更時は`grep`で全スキルを横断チェック：

```bash
# CLAUDE.mdで変更したキーワードがスキルに矛盾して記載されていないか確認
grep -r "RLS\|migration\|security" .claude/skills/
```

### Phase 3（中期）: CI統合

- Promptfooでゴールデンテストセット作成
- GitHub Actionsでマイグレーション変更時に自動評価
- スコア閾値を下回るとマージブロック

### Phase 4（長期）: 外部レジストリ

- Langfuse等でエイリアス管理
- ステージング/本番の分離
- 全LLM出力にプロンプトバージョンIDをタグ付け

---

## 10. 矛盾が発生した際のデバッグ手順

1. **矛盾箇所の特定**: 問題のある出力を起こしたスキル・エージェントを特定
2. **レイヤー確認**: CLAUDE.md vs スキル本文のどちらが矛盾しているか
3. **責任の所在**: その指示はグローバル（CLAUDE.md）か固有（スキル）か判断
4. **削除 or 移動**: 重複なら片方を削除、矛盾なら正しい方を残して他を削除
5. **テスト**: 修正後に関連するゴールデンケースで動作確認

---

## 主要情報源

| 情報源 | 内容 |
|---|---|
| [Claude Code: Create Custom Subagents](https://code.claude.com/docs/en/sub-agents) | CLAUDE.md伝播の公式仕様 |
| [Claude Code: Extend with Skills](https://code.claude.com/docs/en/skills) | SKILL.md設計ガイドライン |
| [Claude Code: Best Practices](https://code.claude.com/docs/en/best-practices) | CLAUDE.md何を書くか/書かないか |
| [Anthropic: Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system) | サブエージェント委任の4要素 |
| [Anthropic: Effective Harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | エージェント間プロンプト一貫性 |
| [arXiv: Mass Framework (2502.02533)](https://arxiv.org/html/2502.02533v2) | 階層的プロンプト最適化の理論 |
| [Google ADK: Multi-Agent Patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) | 静的命令・テンプレート変数パターン |
| [Vellum: Context Engineering](https://www.vellum.ai/blog/multi-agent-systems-building-with-context-engineering) | マルチエージェント設計パターン |
| [Agenta: CI/CD for LLM Prompts](https://agenta.ai/blog/cicd-for-llm-prompts) | プロンプトCI/CD実装ガイド |
| [MLflow Prompt Registry](https://mlflow.org/prompt-registry) | SSoTレジストリ実装 |
| [Langfuse Prompt Management](https://langfuse.com/docs/prompt-management/get-started) | エイリアスベース管理 |
| [Promptfoo GitHub](https://github.com/promptfoo/promptfoo) | OSS評価・CI統合ツール |
