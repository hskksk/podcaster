# D2・Mermaid・PlantUML などをターミナルに ASCII アート描画するツール

## 概要

「Diagram as Code（図表をコードで記述する）」は、Mermaid、PlantUML、D2、Graphviz DOT などのテキスト記法から図を生成する手法として定着している。通常、これらのツールは SVG や PNG などのビットマップ画像を出力するが、**ターミナル上でそのまま表示できる ASCII/Unicode テキスト出力**を求める場面は少なくない。

具体的には次のようなニーズがある。

- **SSH 先や CI ログ**でブラウザなしに図を確認したい
- **README や man ページ、ソースコードコメント**に図を埋め込みたい（画像ファイルを別途配布したくない）
- **プレーンテキスト環境**（メール、Slack のコードブロック、エディタのターミナルペイン）で図を共有したい
- **AI エージェントや CLI ツール**が図の構造を機械可読な形で扱いたい

本レポートでは、Mermaid・D2・PlantUML・Graphviz など主要な diagram-as-code 言語を**ターミナル向け ASCII/Unicode アートとして描画できるツール**を体系的に調査・整理する。

重要な前提として、ターミナル描画には大きく **2 つのアプローチ**がある。

1. **真の ASCII/Unicode テキスト描画** — `+`, `-`, `|`, `┌`, `─`, `│` などの文字でボックスと矢印を描く。どんなターミナルでも表示可能。
2. **ターミナルグラフィックスプロトコル** — Kitty Graphics Protocol、iTerm2 OSC 1337、Sixel などで PNG/SVG をラスタライズして表示。見た目は美しいが、ASCII アートではない。

本レポートの主題は 1 だが、2 も「ターミナルで図を見る」文脈では競合・補完関係にあるため、関連ツールも触れる。

---

## 背景・歴史

### Diagram as Code の台頭

2010 年代以降、ドキュメントを Git で管理する文化とともに、テキストで書ける図表言語が普及した。

- **PlantUML**（2009 年〜）: Java ベース。UML 全般に強く、シーケンス図の de facto standard 的存在。
- **Graphviz / DOT**（1990 年代〜）: レイアウトエンジンとして根強い。PlantUML の内部でも利用される。
- **Mermaid**（2014 年〜）: JavaScript 実装。GitHub・GitLab・Notion など Markdown ネイティブレンダリングにより爆発的に普及。
- **D2**（2022 年〜, Terrastruct）: Go 実装。モダンな構文と ELK/TALA レイアウトで「美しいアーキテクチャ図」を志向。

これらは当初 SVG/PNG 出力が中心だった。

### ASCII 出力の歴史的経緯

**PlantUML** は比較的早い段階から ASCII アート出力を公式サポートしている。`-txt` / `-utxt` フラグでシーケンス図を `.atxt` / `.utxt` ファイルとして生成できる。公式サイトも「sequence diagrams only」と明記しており、フローチャートやクラス図の ASCII 出力は限定的。

**Graphviz** 側では、Perl の **Graph::Easy**（2000 年代）が DOT や独自記法から ASCII/Unicode ボックスアートを生成する古典的ソリューションとして知られる。2025 年頃、Graphviz 13.0 で `-Tascii`（AAlib 依存）が追加されたが、ビルド依存の問題があり実用は限定的。

**Mermaid** については、公式 `mermaid-cli`（mmdc）は Puppeteer + ヘッドレス Chrome で SVG/PNG/PDF を生成するのみで、**ASCII 出力は非対応**。このギャップを埋めるため、2020 年代に Go/Rust/TypeScript/Python 製のサードパーティ CLI が相次いで登場した。

**D2** は 2025 年 8 月の v0.7.1 で ASCII レンダラを正式追加。`.txt` 拡張子または `--stdout-format ascii` で出力可能。現時点では alpha/beta 扱い。

### 2025–2026 年の潮流

AI コーディングエージェント（Claude Code、Cursor、Codex 等）の普及に伴い、「エージェントがターミナルで図を描画・検査できる CLI」が新たな設計要件になっている。`mmdflux` の MMDS JSON、`meraid` の `--format json`、`beautiful-mermaid-cli` の `--json` 契約、`mermkit serve` の NDJSON IPC など、**人間可読テキスト + 機械可読メタデータ**の二層出力が増えている。

---

## 核となる概念

### 文字セット: ASCII vs Unicode Box-Drawing

ほぼすべてのツールが 2 モードを提供する。

| モード | 使用文字 | 利点 | 欠点 |
|--------|----------|------|------|
| **Standard ASCII** | `+`, `-`, `|`, `>`, `<` | 7-bit 環境、古い端末、メールゲートウェイでも安全 | 見た目が粗い |
| **Extended / Unicode** | `┌`, `─`, `│`, `└`, `►` 等 | 視認性が高い | UTF-8 必須、フォント依存、CJK 混在時に幅計算が複雑 |

CJK（日本語・中国語・韓国語）を含むラベルでは、文字幅（全角/半角）の計算がレイアウト崩れの原因になる。`meraid` や `termaid` は CJK-aware な幅計算を謳っている。

### レンダリングパイプライン

典型的な ASCII 図表レンダラは次の 4 段階で動作する。

1. **Parse（構文解析）** — ソーステキストを AST/内部モデルに変換
2. **Layout（レイアウト）** — ノード座標、エッジ経路を計算（Sugiyama 法、A* 経路探索、ELK 等）
3. **Render（描画）** — 2D 文字グリッド（キャンバス）にボックス・矢印・ラベルを描く
4. **Output（出力）** — 文字列として stdout またはファイルに書き出し

D2 の ASCII レンダラは、ELK レイアウトで決定した座標を**ダウンスケール**して離散グリッドに投影する方式。Mermaid 系の `mermaid-ascii` ファミリーは、グリッド配置 + A* パスファインディングが主流。

### レイアウトエンジンの違い

| エンジン | 採用例 | 特徴 |
|----------|--------|------|
| **自前レイアウト** | mermaid-ascii, mmdflux (flux-layered) | 直交ルーティング、決定論的、ターミナル向けに最適化 |
| **ELK** | D2 ASCII, mmdflux (mermaid-layered) | 複雑グラフに強い、曲線は ASCII 向きでない |
| **Graphviz dot** | hascii, graph-easy | 成熟したレイアウト、外部 `dot` バイナリ依存 |
| **dagre（JS）** | mermaid.js（ブラウザ） | Mermaid 公式 SVG 出力のデフォルト |

### ターミナルグラフィックス vs 純テキスト

| 方式 | 代表ツール | 入力 | 出力 | 依存 |
|------|-----------|------|------|------|
| 純テキスト ASCII | mermaid-ascii, d2, plantuml -txt | .mmd, .d2, .puml | 文字列 | 軽量 |
| ラスタライズ + プロトコル | glowm, kitmd, krk | .md, .mmd | PNG → Kitty/iTerm2 | Chrome または resvg |
| 画像 → 文字アート | chafa, jp2a | PNG/SVG | ブロック/Braille 文字 | 元画像が必要 |

「diagram-as-code → 直接 ASCII」が本レポートの焦点。後者 2 つは「既存 SVG をターミナル表示する」迂回経路。

---

## 入力言語別ツール一覧

### Mermaid 向けツール

Mermaid は diagram-as-code で最もエコシステムが大きく、ASCII ターミナル描画ツールも最多。

#### mermaid-ascii（AlexanderGrooff / pgavlin fork）

- **言語**: Go
- **GitHub**: https://github.com/AlexanderGrooff/mermaid-ascii（pgavlin/mermaid-ascii が活発な fork として存在）
- **特徴**: **22 種類の Mermaid ダイアグラムタイプ**をサポート（flowchart, sequence, class, state, ER, gantt, pie, mindmap, gitGraph, C4, sankey 等）
- **CLI**:
  ```bash
  mermaid-ascii -f diagram.mermaid
  echo 'graph LR; A-->B' | mermaid-ascii
  mermaid-ascii -f diagram.mermaid --ascii   # 純 ASCII
  mermaid-ascii -f diagram.mermaid -x 8 -y 3 # パディング調整
  ```
- **Web サーバー**: `mermaid-ascii web` で HTTP 経由レンダリング
- **ライブラリ**: Go パッケージとして `render.Render()` API 提供
- **パイプライン**: Detect → Parse → Layout（グリッド + A*） → Render（2D キャンバス）

#### mmdflux（kevinswiber）

- **言語**: Rust
- **特徴**: ターミナルテキスト出力を**第一級**として設計。独自レイアウトエンジン `flux-layered`（直交ルーティング）と Mermaid 互換 `mermaid-layered`（ELK）の 2 エンジン
- **出力**: Unicode text, ASCII text, SVG, **MMDS JSON**（ノード座標・エッジ経路・サブグラフ境界を含む構造化 JSON）
- **対応図**: flowchart, class, sequence, state
- **CLI**:
  ```bash
  mmdflux diagram.mmd                        # デフォルト text 出力
  mmdflux --format text diagram.mmd
  mmdflux --format mmds --geometry-level routed diagram.mmd
  echo 'graph LR; A-->B-->C' | mmdflux
  brew install kevinswiber/mmdflux/mmdflux   # macOS
  cargo install mmdflux
  ```
- **AI/エージェント向け**: MMDS フォーマットで LLM パイプラインが幾何情報を直接消費可能。WASM パッケージと Playground（https://play.mmdflux.com）も提供
- **ANSI カラー**: Mermaid の `style`/`classDef` をターミナル色にマッピング（`NO_COLOR=1` で無効化）

#### meraid（Binlogo）

- **言語**: Rust（pure Rust、Node/ブラウザ不要）
- **対応図**: flowchart, sequence, class, state, pie, ER（6 種）
- **CLI**:
  ```bash
  meraid diagram.mmd
  meraid diagram.mmd --ascii
  meraid diagram.mmd --theme neon
  meraid diagram.mmd --format json   # AI 向け JSON 出力
  ```
- **CJK 対応**: 日本語/中国語/韓国語ラベルでボックス境界がずれにくい

#### termaid（fasouto）

- **言語**: Python（pure Python、外部依存なし）
- **対応図**: **18 種類**（flowchart, sequence, class, ER, state, block, git, gantt, architecture, pie, treemap, mindmap, timeline, kanban, quadrant, XY chart, user journey, packet）
- **CLI**:
  ```bash
  termaid diagram.mmd
  cat diagram.mmd | termaid
  termaid diagram.mmd --ascii
  termaid diagram.mmd --theme neon
  termaid diagram.mmd --tui          # インタラクティブ TUI
  termaid --json treemap data.json   # JSON データから図生成
  ```
- **Rich/Textual 統合**: カラー出力、TUI ウィジェット
- **6 テーマ**: default, terra, neon, mono, amber, phosphor
- **mermaid-ascii 系**: 同作者の termaid は mermaid-ascii の思想を Python で拡張した位置づけ

#### beautiful-mermaid / beautiful-mermaid-cli（lukilabs / okooo5km）

- **言語**: TypeScript（zero DOM dependencies）
- **特徴**: mermaid-ascii（Go）を TypeScript に移植・拡張。SVG と ASCII の**デュアル出力**
- **対応図**: flowchart, state, sequence, class, ER, XY chart（6 種）
- **CLI（`bm`）**:
  ```bash
  bm diagram.mmd -o out.svg
  bm ascii diagram.mmd
  bm ascii diagram.mmd --ascii --color-mode truecolor
  bm ascii --json -c $'graph LR\n  A-->B'   # エージェント向け JSON
  npm i -g beautiful-mermaid-cli
  brew install okooo5km/tap/bm
  ```
- **15 テーマ**: Shiki 互換、CSS カスタムプロパティ
- **速度**: 100+ ダイアグラムを 500ms 未満でレンダリング（公式ベンチマーク）

#### mermaid2term（watzon）

- **言語**: TypeScript
- **CLI**:
  ```bash
  mermaid2term diagram.mmd
  mermaid2term --charset ascii diagram.mmd
  ```
- **ライブラリ API**: `RenderOptions` で charset, paddingX/Y, borderPadding を制御

#### termiflow（dnvt）

- **言語**: Rust
- **特徴**: Mermaid **フローチャート特化**（フル Mermaid 互換ではない）
- **9 ボーダースタイル**: ascii, unicode, double, rounded, heavy, dots, plus, stars, blocks
- **CLI**:
  ```bash
  tw diagram.md
  tw --style ascii diagram.md
  tw --watch diagram.md    # ライブプレビュー
  tw --tui diagram.md      # フルスクリーン TUI
  ```
- **監査機能**: `--audit`, `--optimize-render` で ASCII 品質改善

#### graphs-tui（decisiongraph）

- **言語**: Rust（**zero dependencies**）
- **対応**: Mermaid（flowchart, state, pie）+ **D2**（基本構文）
- **ライブラリ API**:
  ```rust
  use graphs_tui::{render_mermaid_to_tui, render_d2_to_tui, RenderOptions};
  let output = render_d2_to_tui("A -> B: connection", RenderOptions::default()).unwrap();
  ```
- **自動検出**: Mermaid vs D2 を自動判別

#### mermkit（MermaidKit）

- **言語**: TypeScript
- **特徴**: 複数エンジンをオーケストレーション（embedded mermaid.js, mmdc, 自前 ascii レンダラ）
- **出力**: SVG, PNG, PDF, **ASCII**, ターミナルインライン画像（Kitty/iTerm2）
- **エージェント**: `mermkit serve` で NDJSON IPC
- **CLI**:
  ```bash
  mermkit render --in diagram.mmd --format ascii
  ```

#### nereid（bnomei）

- **言語**: Rust（ratatui TUI + MCP サーバー）
- **特徴**: Mermaid ダイアグラムの**編集・探索・エクスポート**ワークスペース。テキストプレビュー出力
- **MCP ツール**: AI エージェントがダイアグラムを構造的に変更可能

#### 公式 mermaid-cli（参考: ASCII 非対応）

- `@mermaid-js/mermaid-cli`（mmdc）は SVG/PNG/PDF のみ。ASCII 出力なし。
- ターミナル用途には上記サードパーティツールが必要。

---

### D2 向けツール

#### D2 公式 CLI（terrastruct/d2）

- **言語**: Go
- **ASCII 追加**: v0.7.1（2025-08-19）
- **使い方**:
  ```bash
  d2 diagram.d2 diagram.txt              # .txt 拡張子で ASCII 自動検出
  d2 diagram.d2 -                       # stdout
  d2 diagram.d2 - --stdout-format ascii
  d2 diagram.d2 out.txt --ascii-mode=standard   # 純 ASCII
  d2 diagram.d2 out.txt --ascii-mode=extended   # Unicode（デフォルト）
  ```
- **レイアウト**: ELK または TALA のみ（Dagre は ELK にフォールバック）。曲線は ASCII 向きでないため
- **Vim 拡張**: `.d2` 編集 + プレビューウィンドウ、選択範囲を ASCII に置換（コードコメント埋め込み）
- **制限（alpha）**:
  - スタイル・テーマ・アニメーション非対応
  - Markdown/LaTeX/コードブロック、画像・アイコン非対応
  - cloud/circle 等の曲線シェイプは矩形 + 左上アイコンで代替
  - 不等幅スペーシング（離散グリッドの制約）
- **GitHub**: https://github.com/terrastruct/d2

#### graphs-tui（D2 部分サポート）

上記 Mermaid 節参照。D2 の基本構文（`A -> B`, コンテナ `{ }`, エッジラベル `: text`, シェイプ `.shape: type`）に対応。

---

### PlantUML 向けツール

#### PlantUML 公式 CLI

- **言語**: Java
- **ASCII 出力**: 公式サポート（主に**シーケンス図**）
- **CLI**:
  ```bash
  plantuml -txt diagram.puml      # 純 ASCII → diagram.atxt
  plantuml -utxt diagram.puml     # Unicode → diagram.utxt
  java -jar plantuml.jar -txt diagram.puml
  ```
- **パラメータ**: `skinparam maxAsciiMessageLength 8` で幅制限
- **制限**: 公式サイトは「ASCII art (available only for sequence diagrams)」と明記。フローチャート・クラス図等の ASCII は `-txt` でも期待通りにならない場合がある
- **Web サービス**: `/plantuml/txt/ENCODED` で ASCII Art（シーケンス図のみ）

#### Kroki（PlantUML プロキシ）

- **HTTP API**: diagram-as-code → 各種フォーマット
- **PlantUML ASCII**:
  ```bash
  curl -X POST https://kroki.io/plantuml/txt \
    -H "Content-Type: text/plain" \
    -d "@diagram.puml"
  curl https://kroki.io/plantuml/utxt/<encoded>
  ```
- **Asciidoctor 連携**: `[plantuml,format=txt]` ブロックでリテラルブロックとして埋め込み
- **txt vs utxt**: txt=純 ASCII、utxt=Unicode ボックス描画

#### edd（kungfusheep）

- **言語**: Go
- **特徴**: ターミナルベースの**ダイアグラムエディタ** + フォーマット変換
- **Import**: Mermaid, PlantUML, Graphviz DOT, D2, JSON
- **Export**: ASCII/Unicode, Mermaid, PlantUML, JSON
- **CLI**:
  ```bash
  edd -i diagram.puml
  edd -format ascii diagram.puml    # ターミナルに ASCII 出力
  edd -format mermaid diagram.puml > output.mmd
  ```
- **編集**: vim 風モーダル編集

---

### Graphviz / DOT 向けツール

#### hascii

- **言語**: Python
- **特徴**: Graphviz `dot` でレイアウト → ボックス描画 ASCII/Unicode + ANSI カラー
- **CLI**:
  ```bash
  hascii flow.dot
  echo 'digraph { A -> B -> C }' | hascii -
  hascii --no-color flow.dot > flow.txt
  hascii --width 72 --max-label 25 flow.dot
  uvx hascii flow.dot   # uv 経由でインストール不要実行
  ```
- **依存**: Graphviz（`dot` バイナリ）必須
- **API**: `hascii.render(dot_source, color=False, max_width=72)`

#### graph-easy（Graph::Easy）

- **言語**: Perl
- **特徴**: 2000 年代からの古典的 ASCII グラフレンダラ。DOT, Graph::Easy 記法, VCG, GDL 等を入力
- **CLI**:
  ```bash
  graph-easy diagram.dot --as_ascii
  cat input.dot | graph-easy --from=dot --as_ascii
  graph-easy diagram.dot --as_boxart   # Unicode boxart
  ```
- **Ubuntu**: `sudo apt install libgraph-easy-perl`

#### Graphviz 13.0 `-Tascii`

- AAlib サポート付きビルドでのみ利用可能
- `dot -Tascii input.dot`
- 2025 年時点では配布版に含まれないことが多く、実用性は hascii / graph-easy に劣る

---

## マルチフォーマット対応ツール

### edd

PlantUML, Mermaid, DOT, D2, JSON 間の変換 + ASCII 出力。エディタとしても機能。

### pinstar（reekta92）

- **言語**: Rust（ratatui）
- **対応**: Obsidian Canvas, Mermaid, Graphviz DOT, PlantUML
- **特徴**: インタラクティブ TUI エディタ。ASCII 出力というより TUI 上での図編集・プレビュー
- **制限**: PlantUML では diamond/stadium シェイプ非対応、画像は簡易ノード表示

### Kroki

PlantUML, Mermaid, Graphviz, D2, Ditaa, SvgBob 等 **30+ エンジン**を HTTP API で統合。テキスト出力（txt/utxt/atxt）は PlantUML 中心。Mermaid/D2 の ASCII は各エンジンの能力に依存。

---

## ターミナルグラフィックス方式（参考）

純 ASCII ではないが、「ターミナルで diagram-as-code を見る」文脈で重要。

| ツール | 方式 | 対応 | 依存 |
|--------|------|------|------|
| **glowm** | Chrome + Mermaid.js → PNG → Kitty/iTerm2/Ghostty | Markdown 内 Mermaid | Chrome |
| **kitmd** | Rust Mermaid パーサ + resvg → Kitty Graphics | .md, .mmd | Kitty 系端末 |
| **markdown-reader** | mermaid-rs-renderer + ratatui-image | 16 Mermaid タイプ | Kitty/Sixel/iTerm2 |
| **krk** | Kroki API → Kitty 表示 | .puml, .dot, .mmd 等 | Kroki, Kitty |
| **mdriver** | Mermaid → 画像 → Kitty protocol | Markdown | Kitty 系 |

これらは SSH 先で「きれいな図」を見たい場合に有効だが、**プレーンテキストとしてコピー・貼り付けできない**点が ASCII 方式との決定的な違い。

---

## 詳細な仕組み・技術比較

### レンダリング品質のトレードオフ

| 観点 | 専用 ASCII レンダラ | SVG→ASCII 変換 | ターミナル画像 |
|------|-------------------|---------------|--------------|
| テキストコピー | ◎ | ○ | × |
| CI/ログ埋め込み | ◎ | ◎ | △ |
| 複雑な図 | △〜○ | △ | ◎ |
| 依存の軽さ | ◎ | ○ | △ |
| CJK 対応 | ツール依存 | ツール依存 | ◎ |

### 対応ダイアグラムタイプ比較（主要 CLI）

| ツール | Flowchart | Sequence | Class | State | ER | Gantt | Pie | その他 |
|--------|-----------|----------|-------|-------|-----|-------|-----|--------|
| mermaid-ascii | ◎ | ◎ | ◎ | ◎ | ◎ | ◎ | ◎ | 22 種 |
| termaid | ◎ | ◎ | ◎ | ◎ | ◎ | ◎ | ◎ | 18 種 |
| mmdflux | ◎ | ◎ | ◎ | ◎ | - | - | - | MMDS JSON |
| meraid | ◎ | ◎ | ◎ | ◎ | ◎ | ◎ | - | JSON 出力 |
| beautiful-mermaid | ◎ | ◎ | ◎ | ◎ | ◎ | - | - | XY chart |
| D2 CLI | ◎ | △ | △ | △ | △ | - | - | alpha |
| PlantUML -txt | △ | ◎ | △ | △ | △ | - | - | 公式は sequence 中心 |
| hascii | ◎ | - | - | - | - | - | - | DOT 一般 |
| graphs-tui | ○ | - | - | ○ | - | - | ○ | D2 基本 |

（◎=強い、○=部分的、△=限定的、-=非対応）

### インストール方法まとめ

```bash
# Rust 系
cargo install mmdflux
cargo install meraid
# mermaid-ascii: Go バイナリを GitHub Releases から

# Go 系
go install github.com/AlexanderGrooff/mermaid-ascii@latest

# Node 系
npm i -g beautiful-mermaid-cli   # bm コマンド
npm i -g mermaid2term

# Python 系
pip install termaid
pip install hascii
uvx hascii flow.dot

# 公式
brew install d2                  # D2 CLI
brew install plantuml            # PlantUML
brew install graphviz            # dot

# macOS Homebrew タップ
brew install kevinswiber/mmdflux/mmdflux
brew install okooo5km/tap/bm
```

---

## 具体例・応用事例

### CI ログへの埋め込み

GitHub Actions や GitLab CI でアーキテクチャ変更を ASCII 図として PR コメントに貼る:

```yaml
- name: Render architecture diagram
  run: |
    mmdflux --format text docs/architecture.mmd >> $GITHUB_STEP_SUMMARY
```

`mmdflux` や `meraid` は Node/Chrome 不要のため CI 向き。

### ソースコードコメント

D2 公式ブログが推奨するパターン:

```go
// 処理フロー:
// ┌────────┐     ┌────────┐
// │ Parse  │────>│ Render │
// └────────┘     └────────┘
```

D2 Vim 拡張で `.d2` コード選択 → ASCII 置換が可能。

### man ページ・Asciidoctor

Kroki + Asciidoctor で PlantUML シーケンス図を man ページに:

```asciidoc
[plantuml,format=txt]
----
alice -> bob: hello
----
```

### AI エージェント連携

```bash
# 構造化 JSON でエージェントが図の幾何を理解
meraid diagram.mmd --format json
mmdflux --format mmds --geometry-level routed diagram.mmd
bm ascii --json -c $'graph LR\n  A-->B'
```

MMDS はノード ID、座標、エッジ経路を JSON で返すため、エージェントが「A の右に B を追加」等の編集を座標レベルで計画できる。

### SSH 先でのドキュメント閲覧

```bash
cat README.md | glow README.md          # Markdown + Mermaid（Kitty 必要）
mmdflux docs/flow.mmd                     # どんな端末でも ASCII
```

---

## 重要人物・文献

### プロジェクト・作者

| 人物/組織 | プロジェクト | 貢献 |
|-----------|-------------|------|
| **Terrastruct / alixander** | D2 | モダン diagram-as-code、v0.7.1 ASCII レンダラ |
| **Alexander Grooff** | mermaid-ascii | Go 製 Mermaid→ASCII の草分け |
| **Kevin Swiber** | mmdflux | Rust 製、MMDS JSON、ターミナルファースト |
| **Craft Docs / lukilabs** | beautiful-mermaid | TS 移植、SVG+ASCII デュアル、高速 |
| **Arnaud Roques 等** | PlantUML | UML diagram-as-code、ASCII シーケンス図 |
| **Camille Bilodeau (Tels)** | Graph::Easy | Perl ASCII グラフの古典 |
| **Kroki (Yuzutech)** | Kroki | 多エンジン HTTP 統合 |

### 参考ドキュメント

- D2 ASCII 公式: https://d2lang.com/blog/ascii/
- D2 Exports: https://d2lang.com/tour/exports/
- PlantUML ASCII Art: https://plantuml.com/ascii-art
- PlantUML CLI: https://plantuml.com/command-line
- Graphviz ASCII output: https://graphviz.org/docs/outputs/ascii/
- Kroki Usage: https://docs.kroki.io/kroki/setup/usage/
- mmdflux MMDS spec: https://github.com/kevinswiber/mmdflux/blob/main/docs/mmds.md

---

## 最新動向・未解決問題

### 2025–2026 年のトレンド

1. **Rust 製 CLI の集中**: mmdflux, meraid, termiflow, graphs-tui, pinstar, kitmd など。高速・単一バイナリ・CI 向き。
2. **AI エージェント向け JSON 出力**: MMDS, `--format json`, NDJSON IPC が標準化しつつある。
3. **D2 ASCII の alpha 段階**: 公式サポート開始は画期的だが、スタイル・特殊シェイプは未成熟。
4. **Mermaid 22+ タイプ対応の競争**: mermaid-ascii/termaid が公式 mermaid.js の機能追加に追従。
5. **ターミナルグラフィックスの成熟**: Kitty/Ghostty 普及で「ASCII か画像か」の二択が「ASCII + 画像フォールバック」のハイブリッドに。

### 未解決・課題

- **Mermaid 公式 ASCII 非対応**: mmdc に ASCII 出力がないため、エコシステムが分断。
- **レイアウト品質**: ASCII は離散グリッドの制約で SVG より劣る。サブグラフ、対角線、曲線シェイプは各ツールで未対応が多い。
- **PlantUML ASCII の diagram 種別制限**: シーケンス図以外は期待通りにならない。
- **CJK 混在レイアウト**: 全角文字幅計算はツールごとに実装差があり、日本語ラベルで崩れることがある。
- **色とスタイル**: ASCII 出力での ANSI カラー対応は mmdflux, termaid, beautiful-mermaid 等に限定的。
- **テスト・互換性**: Mermaid 仕様の頻繁な変更（`architecture-beta`, `block-beta` 等）への追従コスト。

---

## 関連トピック

### ditaa / svgbob（逆方向: ASCII → 画像）

- **ditaa**: ASCII アート（`| / - +`）→ PNG/SVG。**入力が ASCII** であり、本レポートの「diagram-as-code → ASCII 出力」とは逆方向。
- **svgbob**: ASCII スケッチ → SVG。同様に逆方向。

### Structurizr / C4 モデル

Structurizr CLI は PlantUML/Mermaid/D2 へエクスポート可能。ターミナル ASCII 直接出力はなく、エクスポート先（PlantUML `-txt` や mmdflux 等）を経由する。

### 汎用 ASCII アート生成

- **jp2a**, **chafa**: 画像 → ターミナル文字アート（diagram-as-code とは無関係）
- **boxes**（boxes.dev）: テキストボックス生成 CLI
- **Graph::Easy**: DOT 以外のグラフ記法も ASCII 化

### Markdown ターミナルビューア

- **glow**: Markdown 表示（Mermaid 非対応）
- **glowm**: glow + Mermaid インライン画像
- **bat**: シンタックスハイライト（図表レンダリングなし）

---

## ツール選定ガイド

| ユースケース | 推奨ツール |
|-------------|-----------|
| Mermaid を最も多くの diagram タイプで ASCII 化 | **termaid** または **mermaid-ascii** |
| Mermaid を CI/SSH で軽量に、Rust 単一バイナリ | **meraid** または **mmdflux** |
| AI エージェントが図の座標を理解 | **mmdflux**（MMDS） |
| Mermaid + 美しい SVG/ASCII 両方、Node OK | **beautiful-mermaid-cli**（bm） |
| D2 ソースをそのまま ASCII 化 | **D2 CLI**（v0.7.1+） |
| D2 + Mermaid 両方、Rust ライブラリ | **graphs-tui** |
| PlantUML シーケンス図を ASCII 化 | **PlantUML -txt/-utxt** または **Kroki** |
| PlantUML/Mermaid/DOT/D2 変換 + 編集 | **edd** |
| Graphviz DOT を ASCII 化 | **hascii** または **graph-easy** |
| ターミナルで「きれいな」Mermaid（ASCII 不要） | **glowm**, **kitmd**, **krk** |
| フローチャート特化 + ライブプレビュー | **termiflow** |

---

## 参考リンク

### 公式ドキュメント
- https://d2lang.com/blog/ascii/
- https://d2lang.com/tour/exports/
- https://plantuml.com/ascii-art
- https://plantuml.com/command-line
- https://graphviz.org/docs/outputs/ascii/
- https://docs.kroki.io/kroki/setup/usage/

### Mermaid → ASCII
- https://github.com/AlexanderGrooff/mermaid-ascii
- https://github.com/pgavlin/mermaid-ascii
- https://github.com/kevinswiber/mmdflux
- https://github.com/Binlogo/meraid
- https://github.com/fasouto/termaid
- https://github.com/lukilabs/beautiful-mermaid
- https://github.com/okooo5km/beautiful-mermaid-cli
- https://github.com/watzon/mermaid2term
- https://github.com/dnvt/termiflow
- https://github.com/MermaidKit/mermkit
- https://github.com/bnomei/nereid

### D2 / マルチフォーマット
- https://github.com/terrastruct/d2
- https://github.com/decisiongraph/graphs-tui
- https://github.com/kungfusheep/edd
- https://github.com/reekta92/pinstar

### Graphviz / DOT
- https://pypi.org/project/hascii/
- https://metacpan.org/pod/Graph::Easy
- https://github.com/ironcamel/Graph-Easy

### ターミナルグラフィックス
- https://github.com/atani/glowm
- https://github.com/wensheng/kitmd
- https://github.com/leboiko/markdown-reader
- https://github.com/hwblx/krk

### 比較・解説記事
- https://diagrams.so/learn/diagram-as-code-comparison
- https://utilitykit.tools/blog/mermaid-vs-plantuml-vs-graphviz
- https://infrasketch.net/blog/best-diagram-as-code-tools-2026
