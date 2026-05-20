# TypeScript・コーディングエージェント周辺の開発ツール（2025–2026）

## 概要

2025年から2026年にかけて、TypeScript/JavaScript プロジェクトの開発体験は「AIコーディングエージェント」と「高速な品質担保ツール」の二軸で大きく変化している。Claude Code、OpenCode、OpenClaw、Cursor、Codex CLI などのエージェントが PR 生成量を増やす一方で、Biome・Oxlint・Oxfmt といった Rust/Go 製ツールが lint/format のボトルネックを解消し、Lefthook・mise・Renovate・OSV-Scanner などが CI とローカルの境界を再設計している。

本レポートはフロントエンド UI フレームワーク（React/Vue 等）を主題とせず、**DevOps・生産性・品質担保**に焦点を当てる。ユーザーが挙げた **Biome**、**Lefthook**、**omo（Oh My OpenCode）** を軸に、同カテゴリのメジャーな選択肢と、コーディングエージェントと併用される周辺ツールを整理する。

## 背景・歴史

### ESLint + Prettier 時代からの脱却

長年、JS/TS プロジェクトの標準は ESLint（ルール）+ Prettier（整形）+ Husky（Git hooks）+ lint-staged（ステージ済みファイルのみ実行）だった。モノレポ化と CI 時間の増大、そして AI エージェントによる大量の小さな PR が、この構成の弱点（設定の複雑さ、実行時間、ルールの重複）を露呈した。

### Rust/Go 製「高速ツールチェーン」の台頭

2024–2025年に **Biome**（旧 Rome の系譜）、**Oxc プロジェクト**（oxlint / oxfmt）、**dprint** が「1バイナリで lint+format」「Prettier 互換を保ちつつ数十倍高速」という訴求で採用を広げた。2025年6月の **Biome v2** では TypeScript コンパイラに依存しない型推論 lint が本格化し、2026年初頭には **Oxfmt beta** が Prettier 互換テストをほぼ完全にパスしたと発表されている。

### AI エージェントと MCP の標準化

**Model Context Protocol（MCP）** が VS Code、GitHub Copilot、OpenCode、Claude Code など複数クライアントで共通の拡張手段になった。リポジトリ全体を LLM に渡す **Repomix**、プロジェクト規約を書く **AGENTS.md** / **CLAUDE.md**、エージェント統合 CLI **agents-cli** など、「人間向けドキュメント」と「エージェント向けコンテキスト」の二層が定着しつつある。

### TypeScript コンパイラのネイティブ化

Microsoft は 2025年3月に TypeScript の **Go 実装（typescript-go / tsgo）** を発表。大規模コードベースで型チェックが最大約30倍高速、メモリ約3倍削減というベンチマークが示され、将来の **TypeScript 7** に統合される見込みである（2026年時点では `@typescript/native-preview` として試用可能）。

## 核となる概念

### コーディングエージェントとオーケストレーション

| ツール | 位置づけ | 特徴 |
|--------|----------|------|
| **OpenCode** | オープンソースの AI コーディングエージェント | ターミナル/デスクトップ/IDE。LSP 自動読込、マルチセッション、75+ モデル、MCP、プライバシー重視（コード非保存） |
| **Oh My OpenCode（omo）** | OpenCode 向けプラグイン/オーケストレーション層 | マルチエージェント（Planner、Librarian、Explore、Oracle 等）、ビルドパイプライン認識、20+ hooks、MCP/LSP 同梱 |
| **OpenClaw** | 自己ホスト型パーソナル AI アシスタント + Gateway | WhatsApp/Slack 等マルチチャネル。CLI バックエンドとして **opencode-cli** 等を統合（2026年） |
| **Claude Code** | Anthropic 公式 CLI エージェント | CLAUDE.md、サブエージェント、hooks、MCP |
| **Cursor Agent** | IDE + CLI | Plan/Ask モード、Cloud Agent へのハンドオフ |
| **Codex CLI** | OpenAI 系 CLI | クラウドランナーと並行利用 |
| **agents-cli** | 複数エージェントの統一クライアント | パイプライン連鎖、`.agents` 設定、MCP/skills の同期 |

**omo** は「OpenCode をそのまま使うより、専門エージェントに役割分担させたい」チーム向け。インストールは `bunx oh-my-opencode install` 等が一般的。

### Lint / Format の統合と競合

現状は **Biome**、**Oxlint+Oxfmt（Oxc）**、**dprint**、従来の **ESLint 9（flat config）+ Prettier** の四層構造。いずれも「エージェントが何度も `check --fix` する」ワークロードでは速度が採用理由になる。

### Git hooks と pre-commit 品質ゲート

**Husky**（JS エコシステム最大シェア）、**Lefthook**（Go 製・並列・YAML）、**pre-commit**（Python・1000+ フックカタログ）の三強。2026年のベンチマーク記事では Husky が最速起動、Lefthook が並列タスク向き、pre-commit がポリグロット/セキュリティフック向きと整理される。**lint-staged** はステージファイル限定実行として依然 2000万+/週の npm DL があり、Husky とセットが定番。

### モノレポ・CI・依存関係

**Turborepo** / **Nx** / **moon** がタスクキャッシュとリモートキャッシュを提供。**Changesets** がバージョンと CHANGELOG を人間承認型で管理。**Syncpack** / **Sherif** がワークスペース間のバージョン不一致を検出。**taze**（antfu）が対話的に依存を更新。**Renovate** / **Dependabot** が PR ベースの自動更新を担当。

### セキュリティとサプライチェーン

**Socket.dev**、**OSV-Scanner**（Google）、npm 公式連携の強化が、単なる `npm audit` を超えた「悪意あるパッケージ」「インストールスクリプト」「タイポスクワット」検知へシフトしている。

## 詳細な仕組み・理論

### Biome：ESLint + Prettier の一体化

Biome は Rust 実装の linter + formatter。v2（2025年6月）の要点:

- **型推論 lint**: `typescript` パッケージなしで `noFloatingPromises` 等を検出（typescript-eslint の約75%相当とされる報告あり）
- **マルチファイル分析**: プロジェクト横断の型情報インデックス
- **500+ ルール**: ESLint / typescript-eslint 由来を含む
- **対応言語拡張**: JS/TS/JSX/JSON/CSS/GraphQL/HTML 等

設定は `biome.json` 一本化が可能。Vercel、Cloudflare、Discord 等の採用事例が公式ブログで紹介されている。日本語の実践記事でも **Biome + Lefthook** で pre-commit/pre-push 自動化する例が増えている。

```bash
# 典型的な pre-commit（Lefthook 経由）
biome check --staged --no-errors-on-unmatched
```

### Oxc（oxlint / oxfmt）：Oxidation Compiler エコシステム

**oxlint**: Rust 製 linter。ESLint 比 50–100倍高速とされ、500+ ルールを内蔵。型認識 lint は TypeScript の Go ポートを利用。大規模リポでは ESLint と併用し、CI の早い段で oxlint、最終ゲートで ESLint という構成もある。

**oxfmt**: 2025年12月 alpha、2026年2月 beta。Prettier の JS/TS 適合テストを高い割合でパスし、初回実行で Prettier 比約30倍、Biome 比約3倍高速とされる。Tailwind クラスソート、import ソート、複数埋め込み言語（Vue/Svelte 等）を標準機能に含む方向。

Turborepo 公式ガイドでは oxlint/oxfmt を **ルートタスク** として全パッケージ一括実行するパターンが推奨されている。

### Lefthook：並列 Git hooks

Evilmartians 製。`lefthook.yml` で pre-commit / pre-push / commit-msg 等を宣言し、`lefthook install` で `.git/hooks` に注入。

- **並列実行** (`parallel: true`)
- **glob / exclude** によるファイルフィルタ
- **単一バイナリ**（npm/go/brew 等で配布）
- Docker 内実行、タグ付きコマンドグループ

Husky と比べ「モノレポで複数言語」「CI と同じコマンドをローカルで再現」に向く。Biome/Oxlint のような高速 linter と相性が良い。

### mise：ランタイムとタスクの統合

**mise**（旧 rtx）は asdf 互換のポリグロットバージョン管理（Node, Python, Go 等）に加え、環境変数（direnv 的）とタスクランナー機能を持つ。`.mise.toml` をリポジトリにコミットし、エージェント・人間・CI で同一の `node` / `pnpm` バージョンを保証する用途が増えている。2026年4月時点で v2026.4.x 系が活発にリリースされている。

### TypeScript Native（tsgo）

`@typescript/native-preview` の `tsgo` は `tsc` と同様の CLI インターフェースで型チェック・ビルド。未成熟機能（宣言ファイル emit の一部、watch、Language Service API）には注意。エージェントが頻繁に `typecheck` するプロジェクトでは CI 時間短縮の主戦場になりうる。

### MCP とエージェント向けコンテキスト

- **MCP サーバー**: GitHub、DB、Sentry 等をツールとしてエージェントに接続。トークン消費が大きいため選択的有効化が推奨される（OpenCode ドキュメントでも注意）。
- **Repomix**: リポジトリを XML/Markdown 等の1ファイルにパック。Tree-sitter 圧縮、Secretlint、MCP/GitHub Actions 連携。OpenClaw 等でも利用言及あり。
- **AGENTS.md**: Linux Foundation Agentic AI Foundation 系のオープン標準。Codex/Cursor 等が参照。ビルド・テスト・lint コマンド、PR 規約を32KiB程度に収める運用が推奨される。
- **CLAUDE.md**: Claude Code 専用。ディレクトリツリー上へ walk して読み込む点が AGENTS.md と異なる。両方維持する「デュアルファイル」パターンが普及。

### 依存関係・リリース・CI

**Changesets**: 開発者が `pnpm changeset` で変更意図（major/minor/patch）を Markdown で記録 → `changeset version` で一括バンプ。pnpm **catalog**（`pnpm-workspace.yaml` でバージョン定数化）との連携が 2025年以降強化されている。

**Renovate vs Dependabot**: GitHub のみなら Dependabot がゼロ設定で有利。90+ パッケージマネージャ、monorepo、regex manager、自動マージルール、Dependency Dashboard では Renovate が優位。セキュリティ PR の優先度設定は両方とも 2025–2026 年の運用記事で詳述されている。

**Trunk Merge Queue**: AI エージェントによる PR 増加を背景に、バッチテスト・フレーク検知・並列キューで main 保護。GitHub 標準 merge queue の代替として企業導入事例がある。

**actionlint**: GitHub Actions YAML の静的解析。`${{ }}` 式の型チェック、再利用ワークフロー、script injection 検知。CI パイプライン品質の第一歩として定着。

## 具体例・応用事例

### 事例1: Biome + Lefthook + pnpm catalog（中小〜中規模 TS モノレポ）

1. `mise` で Node/pnpm を固定
2. `biome.json` で lint/format を統一
3. `lefthook.yml` の pre-commit で `biome check --staged`
4. pre-push で `turbo run typecheck test`
5. CI で oxlint（任意）→ biome check → vitest
6. Renovate が週次で依存 PR、Socket または OSV-Scanner がセキュリティゲート

エージェント（OpenCode + omo）がコミットを量産しても、hooks が一定品質を担保する。

### 事例2: OpenCode + omo マルチエージェント

- **Planner-Sisyphus**: タスク分解と実装
- **Librarian**: ドキュメント・既存コード探索
- **Explore**: リポジトリ横断検索
- **Oracle**: 設計判断の Q&A

ビルドツール（Vite、Turborepo、カスタム monorepo）を理解した設定が omo の差別化ポイント。MCP で社内 API や DB に接続する場合は、コンテキスト上限を監視する。

### 事例3: 大規模モノレポ（Turborepo + moon + Changesets）

- **moon** または **turbo** でキャッシュ付きビルド
- **Syncpack** で `pnpm list-mismatches` を PR 必須
- **Changesets** でパッケージごと semver
- **Graphite** でスタック PR（レビュー単位を小さく）
- **Trunk** または GitHub merge queue で main 統合

### 事例4: エージェント PR 向けセキュリティ

- **Socket** または **OSV-Scanner** を CI 必須
- **Renovate** の `vulnerabilityAlerts` + グループ化
- `actionlint` で workflow の injection を防止
- **Repomix** でレビュー用コンテキスト生成（シークレットは Secretlint で除去）

### 事例5: テスト品質（Vitest 4）

Vitest 4（2025年10月）で **Browser Mode** が安定版に。Playwright/WebDriverIO プロバイダを別パッケージ化。ビジュアルリグレッション、Playwright trace の第一級サポート。フロントエンド以外でも、TS ライブラリのブラウザ依存 API テストに使われる。

## 重要人物・文献

### プロジェクト・組織

- **Biome**: biomejs コミュニティ（Rust）
- **Oxc**: VoidZero エコシステム（oxc.rs）
- **Lefthook**: Evil Martians
- **OpenCode**: SST / オープンコミュニティ（GitHub 上で高スター数）
- **Oh My OpenCode**: code-yeongyu ほか（GitHub: oh-my-opencode）
- **mise**: jdx
- **Turborepo**: Vercel
- **Changesets**: changesets ワークグループ
- **TypeScript Go**: Microsoft TypeScript チーム

### 参考になる公式ドキュメント

- Biome v2 ブログ: https://biomejs.dev/blog/biome-v2/
- Lefthook: https://lefthook.dev/
- Oh My OpenCode: https://ohmyopencode.com/
- OpenCode docs: https://opencode.ai/docs/
- Oxfmt beta 告知: https://oxc.rs/blog/2026-02-24-oxfmt-beta.html
- TypeScript Native Previews: https://devblogs.microsoft.com/typescript/announcing-typescript-native-previews/
- pnpm catalogs: https://pnpm.io/catalogs
- Vitest 4.0 ブログ: https://vitest.dev/blog/vitest-4

## 最新動向・未解決問題

### 2025–2026 のトレンド

1. **Formatter 戦国時代**: Biome / Oxfmt / dprint が Prettier 互換を争い、ESLint は「ルールの残り」とプラグインエコシステムで共存
2. **型チェックの二速化**: typescript-eslint 型 aware lint、Biome 型推論、tsgo ネイティブコンパイラが並立。どれを CI の正とするかはプロジェクト次第
3. **AI PR と merge queue**: Trunk 等が「エージェント PR 増」向けの製品メッセージを明示
4. **pnpm catalog + Changesets**: モノレポのバージョン単一化が標準パターンに
5. **MCP の爆発**: サーバー数が膨大化。トークンコストとセキュリティ（任意コード実行）が未解決
6. **OpenClaw × OpenCode**: Gateway から opencode-cli バックエンドを呼ぶ統合（2026年 PR）。「チャット UI」と「コーディング CLI」の境界が曖昧に

### 未解決・注意点

- **Biome vs ESLint**: ルールカバレッジ100%ではない。移行は段階的が現実的
- **tsgo**: Language Service・watch・一部 emit が未完了。本番 CI 全面置換は早い場合あり
- **omo / マルチエージェント**: コスト・レイテンシ・一貫性。単一エージェントよりトークン消費が増えやすい
- **エージェントと hooks の競合**: エージェントが `--no-verify` で commit するリスク → CI 必須化とブランチ保護で補完
- **情報の信頼性**: GitHub スター数や「○倍高速」はベンチマーク条件に依存。自リポジトリでの計測を推奨

### その他メジャーなツール（カテゴリ別クイックリファレンス）

| カテゴリ | ツール | 用途 |
|----------|--------|------|
| Lint（従来） | ESLint 9 flat config | 最大エコシステム、段階的移行の受け皿 |
| Format | Prettier, dprint | 業界標準 / WASM プラグイン方式 |
| 未使用検出 | Knip v6（oxc ベース） | 未使用 export・依存・ファイル |
| 構造検索 | ast-grep | AST パターンマッチ lint/rewrite |
| スペル | typos-cli, cspell | PR 向け低ノイズ / 多言語辞書 |
| Git hooks | Husky, pre-commit, Lefthook | エコシステム別の定番 |
| ステージ限定 | lint-staged | 変更ファイルのみ lint |
| バージョン管理 | mise, asdf | ツールチェーン固定 |
| 依存更新 | taze, npm-check-updates, Renovate, Dependabot | ローカル一括 / PR 自動 |
| 依存整合 | syncpack, sherif | monorepo バージョン不一致 |
| 脆弱性 | OSV-Scanner, Socket, npm audit | OSS DB / 悪性パッケージ |
| モノレポ実行 | Turborepo, Nx, moon | キャッシュ・タスクグラフ |
| リリース | Changesets, semantic-release | 人間承認型 / コミット連動型 |
| CI lint | actionlint | GitHub Actions YAML |
| PR フロー | Graphite | スタック PR |
| テスト | Vitest 4, Playwright | ユニット・ブラウザ E2E |
| コンテキスト | Repomix, AGENTS.md | LLM 向けリポジトリ要約 |
| エージェント統合 | agents-cli, MCP servers | 複数 CLI の共通設定 |

## ツール深掘り：ユーザー言及分を中心に

### Biome を選ぶとき / 避けるとき

**選ぶ理由**: 新規プロジェクトで設定ファイルを最小化したい、CI の lint+format を1コマンドにしたい、エージェントが生成するコードを毎回 `biome check --write` したい場合。v2 以降は `noFloatingPromises` など型関連ルールを typescript パッケージなしで部分的にカバーでき、小〜中規模サービスでは typescript-eslint のサブセット代替になりうる。

**慎重になる理由**: 既存の ESLint カスタムルール（import 制限、a11y、testing-library、独自プラグイン）が大量にある。フレームワーク固有ルールは Biome 側の対応状況を個別確認する必要がある。移行は [Biome migration guide](https://biomejs.dev/guides/migrate-eslint/) と `biome migrate eslint` 系コマンドで段階的に行うのが一般的。

**設定の要点**: `organizeImports` を formatter と連動させる、`files.includes` で対象を絞る、monorepo ではルートとパッケージごとに `extends` するネスト設定（v2）を使う。

### Lefthook を Husky から乗り換えるとき

`lefthook.yml` 例（概念）:

```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{js,ts,jsx,tsx,json}"
      run: biome check --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
    types:
      run: pnpm exec tsc --noEmit -p tsconfig.json

pre-push:
  commands:
    test:
      run: pnpm turbo run test --filter=...[origin/main]
```

Husky は `package.json` の `prepare` で `husky install` する文化が強く、npm 中心のチームには依然最適。Lefthook は **Go バイナリ1つ**で Ruby/Python/Node 混在リポの hooks を統一しやすい。ベンチマークでは Husky 起動が最速という記事もあるため、「開発者の体感速度」と「hook 内タスクの並列化」は別軸で評価する。

### omo（Oh My OpenCode）の内部イメージ

omo は OpenCode 本体に **プラグインとして載るオーケストレーション層**である。単一 LLM セッションで全部やらせるのではなく、役割別エージェントにサブタスクを振り分ける。ビルドシステム（Vite、Turborepo、Nx、カスタムワークスペース）を認識する旨が公式サイトで強調されており、モノレポで「間違ったパッケージだけビルドする」類のミスを減らす設計思想と読める。

インストールフロー（典型）:

1. OpenCode を `curl -fsSL https://opencode.ai/install | bash` 等で導入
2. `bunx oh-my-opencode install` または `npm install -g oh-my-opencode`
3. `opencode.json`（またはドキュメント記載の設定ファイル）でエージェントと MCP を有効化

**注意**: GitHub スター数は変動が激しいカテゴリのプロジェクトである。導入前にライセンス、データ送信ポリシー、使用モデルの API コストを確認する。マルチエージェントは品質よりスループットを上げる代わりにトークン単価が上がることが多い。

### OpenCode と OpenClaw の関係（2026年時点）

- **OpenCode**: 開発者向けコーディングエージェント。ターミナル・デスクトップ・IDE。コードは端末側に留め、LSP/MCP で拡張する思想。
- **OpenClaw**: マルチチャネル（Slack 等）のパーソナルアシスタント。**Gateway** が WebSocket 制御プレーン。2026年初頭の統合 PR では、OpenClaw が **opencode-cli** を CLI バックエンドの一つとして呼び出し、プライマリ API が落ちた際のフォールバックや別モデルルートとして使う構成が示されている。

つまり「OpenClaw = 生活/業務インボックス」「OpenCode = リポジトリ編集」という住み分けの上で、必要なら Gateway 経由で同じコーディング能力を引き出す、というアーキテクチャが形成されつつある。

### Knip・ast-grep・Repomix（品質とコンテキスト）

**Knip v6** は未使用の dependencies / devDependencies / exports / ファイルを検出。内部を oxc-parser/resolver に置き換えて 2–4倍高速化したと発表されている。Next.js、Vitest、Nx 等150+ プラグインがあり、モノレポの「死んだパッケージ」を掃除するのに向く。エージェントが大量のファイルを追加したあとの棚卸しに有効。

**ast-grep** は AST パターンマッチで大規模リファクタ（例: `$A && $A()` → `$A?.()`）。codemod を YAML ルールで書ける。ESLint とは別物で、移行期の機械的置換や社内 API 廃止の一括検出に使う。

**Repomix** はエージェントに「リポジトリ全体」を渡す際のトークン節約。Secretlint で秘密情報を落とし、Tree-sitter で構造を保った圧縮をする。Claude Code プラグインや MCP、GitHub Actions から呼べる。プライバシー要件が厳しい場合はローカル CLI のみに留める運用が無難。

### 依存関係・セキュリティの実務

**taze**（`npx taze -r`）は antfu 系の対話的アップデータ。Renovate が「PR を勝手に出す」一方、taze はローカルで一括確認してから人間がコミットするスタイル。`taze.config.js` で exclude や major 更新ポリシーを固定できる。

**Syncpack** は `syncpack list-mismatches` を CI に入れ、ワークスペース間の `react` バージョンズレを防ぐ。AWS/Vercel 等の事例が公式に挙がる。**Sherif** は軽量な「依存の順序・重複・@types の置き場所」lint で、Syncpack より設定が少ない反面、機能は狭い。

**Socket** は npm パッケージのサプライチェーンリスク（インストールスクリプト、難読化、タイポスクワット等）に強み。2026年2月には npm 公式 UI から Socket 分析へのリンクが追加されたという発表がある。**OSV-Scanner** は Google 製で OSV.dev DB に基づく。ロックファイルを渡して CI で回すのが基本。両方とも `npm audit` だけでは拾えない系のインシデント（Shai-Hulud 等）を念頭に置いた運用が推奨される。

### CI・モノレポ・リリースの組み合わせ例

典型的な「2026年型」パイプライン:

```
push/PR → actionlint (workflow変更時)
       → osv-scanner / socket (依存変更時)
       → turbo run lint typecheck test (リモートキャッシュ)
       → changesets/action (release ブランチのみ)
merge  → Trunk Merge Queue または GitHub merge queue
```

**Turborepo 2.5** では self-hosted リモートキャッシュ向け OpenAPI ビューアなど運用面の改善がある。**moon** はツールチェーンの自動ダウンロードと CODEOWNERS 生成まで含む「モノレポ OS」寄りで、Bazel より軽く make より重い、というポジション。

**Graphite**（`gt` CLI）はスタック PR の作成・`gt submit` 一括提出・`gt sync` で、エージェントが小さなコミットを連ねるスタイルと相性がよいとされる。レビュー待ち中に次の PR を積む文化とセット。

### Vitest 4 と Playwright（品質担保）

Vitest 4 で Browser Mode が安定化。`@vitest/browser-playwright` 等を別インストールし、`browser.enabled: true` で実ブラウザテスト。ビジュアルリグレッションと Playwright trace が統合され、UI 以外の TS ライブラリでも「ブラウザ API に触る部分」だけを切り出してテストしやすくなった。

Playwright は E2E のデファクト。エージェントが E2E を生成する場合、**trace + test report を CI  artifact に上げる**運用がフレーク調査に有効。

### コミット規約・リリース

**commitlint** + `@commitlint/config-conventional` は Conventional Commits を機械検証。Lefthook の `commit-msg` フックと組み合わせる。Changesets を使うチームでは「changeset ファイルが PR に含まれるか」を別ジョブで見ることも多い。

**semantic-release** はコミットメッセージから完全自動リリース。Changesets は「人間が changeset md で意図を宣言」する点が対照的。エージェント PR では Changesets の方が監査しやすいという意見が多い。

### エージェント時代の品質ゲート設計原則

1. **ローカルは速く、CI は正しく**: oxlint/biome を pre-commit、フル ESLint/tsc は CI
2. **hooks を bypass できないブランチ保護**: main 直 push 禁止、必須チェック
3. **コンテキストファイルを短く**: AGENTS.md に `pnpm typecheck` / `pnpm test` / lint コマンドを明記し、エージェントの試行錯誤を減らす
4. **MCP は最小限**: 必要なサーバーだけ有効化しコンテキスト枯渇を防ぐ
5. **依存 PR は自動、メジャーは人間**: Renovate の grouping + automerge ルールでパッチのみ自動

### 日本語圏の実践記事から見える採用パターン

Zenn 等では 2025年に **Vite + React + TypeScript + Biome + Lefthook** の新規構築記事が複数ある。Biome v2 対応の「commit/push 時自動チェック」記事では、push 時に test まで回す例も紹介されている。日本語情報は Biome/Lefthook に偏り、Oxlint や omo は英語ドキュメント依存が大きい点に注意。

## 関連トピック

- **Platform Engineering**: 内部 Developer Portal とエージェント設定の一元化
- **SBOM / ライセンス compliance**: エンタープライズでの依存可視化
- **Bazel / Nx affected**: 大規模リポのビルド対象最小化（Trunk Parallel Queues と連携）
- **AI コードレビュー**: Vercel Agent、GitHub Copilot review と人間レビューの役割分担
- **スキル（Agent Skills）**: Cursor/Claude の SKILL.md によるタスク手順の標準化 — 本レポートの podcaster リポジトリでも `podcast-research` 等が例

## 参考リンク

- https://biomejs.dev/
- https://biomejs.dev/ja/blog/biome-v2
- https://lefthook.dev/
- https://github.com/evilmartians/lefthook
- https://ohmyopencode.com/
- https://github.com/code-yeongyu/oh-my-opencode
- https://opencode.ai/
- https://open-code.ai/en/docs/mcp-servers
- https://docs.openclaw.ai/
- https://github.com/openclaw/openclaw
- https://oxc.rs/docs/guide/usage/linter/
- https://oxc.rs/blog/2026-02-24-oxfmt-beta.html
- https://knip.dev/
- https://mise.jdx.dev/
- https://turborepo.dev/docs/features/remote-caching
- https://moonrepo.dev/docs
- https://syncpack.dev/
- https://github.com/antfu-collective/taze
- https://docs.renovatebot.com/
- https://socket.dev/
- https://google.github.io/osv-scanner/
- https://github.com/rhysd/actionlint
- https://commitlint.js.org/
- https://pnpm.io/catalogs
- https://vitest.dev/blog/vitest-4
- https://repomix.com/
- https://ast-grep.github.io/
- https://devblogs.microsoft.com/typescript/announcing-typescript-native-previews/
- https://graphite.com/docs/get-started
- https://docs.trunk.io/merge-queue/merge-queue
- https://zenn.dev/imaimai17468/articles/33e3881405a944
- https://agents-cli.sh/
