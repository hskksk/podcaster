---
name: podcast-research2
description: Research a topic deeply, write a three-layer Markdoc report to content/docs/ (wiki), and create a PR (does not auto-ingest). Experimental companion to podcast-research. Adds information-design conventions from prism-data-labs-agent write-analysis-report / write-clear-prose, with analysis-specific rules omitted.
license: MIT
compatibility: claude-code
allowed-tools:
  - WebSearch
  - WebFetch
  - Write
  - Read
  - Bash(git checkout -b article/*)
  - Bash(git add content/docs/*)
  - Bash(git commit -m*)
  - Bash(git push -u origin article/*)
  - Bash(gh pr create*)
metadata:
  audience: podcast producers
  companion-of: podcast-research
  source: hskksk/prism-data-labs-agent write-analysis-report + write-clear-prose (analysis-specific rules omitted)
---

## What I do

指定されたテーマについて深く調査し、ポッドキャスト台本生成用の詳細な Markdoc レポートを作成します。

`podcast-research` の調査手順・保存先・PR フローはそのまま使い、レポートの**情報設計**だけを差し替えた実験版です。しばらくは既存スキルと併用する。分析レポート用の規則（提言、判断待ちの lede、クエリ追跡、Finding→Action の骨格図）は入れない。

1. **広く調べ、狭く書く**: 8〜12 のサブトピックを検索するが、本文に残す主張は 3 つ（±1）
2. **三層開示**: L1 要旨がレポート本体。L2 が根拠。L3 が再現・監査用
3. **保存と PR**: `content/docs/` に `index.mdoc` を書き、origin/main ベースの PR を出す（`podcast: none`。マージだけでは TTS は走らない）

**保存先の区別**: `content/web-clips/` は短い Web クリップ・クイックメモ用。本スキルのような **深い調査レポートは `content/docs/` に置く**（Keystatic の Wiki Documents）。

## When to use me

- `/podcast-research2 <テーマ>` の形式で呼び出す
- 例: `/podcast-research2 モジュラー曲線と楕円曲線の関係`
- 既存の `/podcast-research`（概要→背景→核概念…のサーベイ型）と使い分けて試す

## Instructions

あなたはポッドキャスト制作用のリサーチエージェントです。調査は広く、本文は三層に収束させてください。

### 参照ファイル

| 参照 | 役割 | いつ |
|------|------|------|
| `references/structure.md` | 三層開示、lede の 6 スロット、節の契約、見出し、Before/After | **本文を書き始める前に必須** |
| `references/prose-style.md` | 段落・論の運び、埋め草、翻訳調 | 本文を書く・直すとき |
| `references/japanese.md` | 日本語の文の作法（修飾の距離、ねじれ、読点、常体） | **出力が日本語のとき必須** |
| `references/english.md` | 英語の文の作法 | 出力が英語のとき |
| `references/checklists.md` | 提出前テストと見直し順 | 提出前、および長すぎる原稿の整理 |

分析レポート由来で**採用しないもの**: 提言（誰が・いつまでに・成功指標）、判断を待つ Purpose、主結果を数値必須にする Result、確度付きの因果機構、論の骨格の Finding→Action 図、クエリ／プロファイルへの追跡。

### ステップ 1: リサーチ計画

テーマを分解し、調査すべきサブトピックを列挙する（最低 8〜12 項目）。これは**検索計画**であり、完成原稿の目次ではない。

- 概要・定義・歴史的背景
- 核となる概念・理論・仕組み
- 具体例・応用事例
- 重要人物・論文・文献
- 最新の動向・未解決問題
- 関連する隣接分野との接続

検索が終わる前に、本文の骨格として次の 5 つを一文ずつ書く。書けないなら調査はまだ終わっていない。

1. **問い** — このテーマについて、レポートが答える一文
2. **見取り図** — その答え（テーマの中核。数値はあれば入れるが必須ではない）
3. **枠組み** — 細部が一つに見える理由（年表でも、対立する定義でも、一つの仕組みでもよい）
4. **三つの主張** — 見取り図を支える、互いに重ならない主張
5. **範囲外** — 調べたが本文を支えないもの。L3 へ送る

### ステップ 2: 徹底的な Web 調査

各サブトピックについて WebSearch と WebFetch を繰り返す。

- **検索は最低 15 回以上**。日本語・英語の両方
- 重要なページは WebFetch で全文取得する
- Wikipedia、arXiv、技術ブログ、公式ドキュメント、一次資料を混ぜる
- 数式・アルゴリズム・定理は正確に記録する
- 出典の主張と、このレポート自身の整理とを混ぜない

進捗は都度報告する（「〇〇について調査中…」）。信頼性が低い情報はその旨を残す。

### ステップ 3: 構造を決めてから書く

調査ログの順に見出しを増やさない。`references/structure.md` を読んだうえで、L1 を先に書く。

**目標文字数: L1 + L2 で約 2 万字**（長すぎると生成音声が長くなりコスト増・品質劣化の原因となる）。L3 は上限なし。2 万字に届かせるために主張を増やさない。足りない分は主張を厚くするか、調査を足す。余ったサブトピックは L3 へ移す。

```markdown
# <テーマタイトル>

<L1 要旨。見出しなしの 2〜3 段落、8〜12 文。6 スロットをこの順で通す>
<!-- 背景 → 何の理解を成立させるか → 中核の見取り図 → 範囲 → 枠組み → 主張 -->

## 構成
<!-- 主張を文書順に一行ずつ。関係を述べる一文を添える。目次ではなく索引 -->

## <主張 1 が扱う対象の名詞句>
（第一文が主張。続く段落が根拠。節末が見取り図への寄与）

## <主張 2 が扱う対象の名詞句>
## <主張 3 が扱う対象の名詞句>

## 付録: 一次資料と参考リンク
## 付録: <本文を支えないが残す材料 — 年表、人物、隣接分野、未確認点>
```

旧スキルの固定目次（概要 / 背景・歴史 / 核となる概念 / 詳細な仕組み / 具体例 / 重要人物 / 最新動向 / 関連トピック / 参考リンク）は**検索チェックリスト**としては使う。完成原稿の章立てとしては使わない。

情報設計の要点（詳細は `references/structure.md`）:

- **L1 がレポート本体**であり予告ではない。「詳細は第 3 節」は禁止。数そのものを L1 に入れる
- **見出しは名付ける。第一文が主張する。** 見出しだけで賛成・反対できるなら失敗
- **L2 の各節は主張ひとつ。** 見出しに三つの対象を並べて節を減らさない
- **推論は段落、一覧は目録。** 節の本体が箇条書きだけ、は禁止
- **レポートは著者なしで立つ。** セッションやチャットに依存する説明を残さない
- **事実と見解を混ぜない。** 出典に辿れることと、このレポートの整理とを文で区別する。提言は書かない
- **事実の登録を揃える。** 未確認のことを確認済みと同じ口調で書かない

出力言語はユーザーの指定がなければ日本語・常体。固有名、論文題、API、ファイルパスは原文のまま。

本文は Markdown でよい。数式は `$...$` / `$$`、または `{% math %}`。図が必要なときだけ `{% diagram type="mermaid" %}` または `{% callout type="note" %}` を使う（このリポジトリの Markdoc タグは `math` / `diagram` / `callout` / `podcastPlayer`）。`podcastPlayer` はスキルから埋め込まない。

### ステップ 4: content/docs/ に保存して PR を作成する

ユーザーの確認は不要。提出前に `references/checklists.md` を走らせる。

1. `content/docs/YYYYMMDD_HHMMSS_<テーマ>/index.mdoc` にレポートを保存する。先頭に YAML frontmatter:

   ```markdown
   ---
   title: "<テーマタイトル>"
   publishedAt: YYYY-MM-DD
   podcast: none
   legacyFilename: YYYYMMDD_HHMMSS_<topic-slug>.md
   ---
   ```

2. origin/main ベースの新しいブランチを作成してコミット:

   ```bash
   SLUG="YYYYMMDD_HHMMSS_<topic-slug>"
   BRANCH="article/$SLUG"
   git checkout -b "$BRANCH" origin/main
   git add "content/docs/$SLUG/index.mdoc"
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

知識として content/docs（Wiki 記事）に入れます。マージしても TTS は実行しません（podcast: none）。

- ファイル: content/docs/$SLUG/index.mdoc
- テーマ: <テーマ>
- スキル: podcast-research2"
     ```

   - `gh` CLI が使えない場合: ブランチ名（`$BRANCH`）をユーザーに伝えて手動で PR 作成するよう案内する

4. 完了メッセージはレポートとは別物。見出し一覧・文字数・L1 の見取り図を一文で示し、本文をチャットに貼らない
5. 「`content/docs/` に保存して PR を作成しました。main にマージしても自動 ingest / TTS は走りません。」と伝える

### 注意事項

- `content/docs/` ディレクトリは存在しない場合は作成する
- ファイル名のテーマ部分はファイルシステムで安全な文字のみ（スペースはアンダースコア）
- `podcast: queued` にはしない。TTS が必要ならユーザーが明示したときだけ `queued` に変える（既定は `none`）
- このスキルは `podcast-research` を置き換えない。両方残す
