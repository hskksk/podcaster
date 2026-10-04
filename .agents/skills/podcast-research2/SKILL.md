---
name: podcast-research2
description: Research a topic deeply, choose the reader's assumed knowledge and a front-, middle-, or rear-weighted information structure, write a Japanese Markdoc report to content/docs/ (wiki), and create a PR (does not auto-ingest). For Japanese prose, use the japanese-writing skill when installed.
license: MIT
compatibility: claude-code
allowed-tools:
  - WebSearch
  - WebFetch
  - Write
  - Read
  - Bash(python3 .agents/skills/podcast-research2/measure.py*)
  - Bash(git checkout -b article/*)
  - Bash(git add content/docs/*)
  - Bash(git commit -m*)
  - Bash(git push -u origin article/*)
  - Bash(gh pr create*)
metadata:
  audience: podcast producers
  companion-of: podcast-research
  source: adaptive report structure + measured Japanese prose rules
---

## What I do

指定されたテーマを深く調査し、ポッドキャスト台本のもとになる Markdoc レポートを書く。

`podcast-research` の保存先・PR の流れを使い、情報設計と日本語の作法を差し替えた実験版である。

1. **読者の前提を決める**: 重心とは別に、何を知っていると仮定し、何から説明するかを決める
2. **広く調べ、価値の中心を選ぶ**: 読者が判断を求めるのか、比較できる資料を求めるのか、論証の追体験を求めるのかを先に決める
3. **重心を一つ選ぶ**: 前重心・中重心・後重心のいずれかを主重心にし、必要なら副重心を一つだけ置く
4. **最初に TL;DR を置く**: タイトル直後の3〜5項目だけで、主要な結論と条件をつかめるようにする
5. **導入の傾斜を緩くする**: 指定がなければ、主題の名前や用途は知っていても内部機構は知らない読者を想定する
6. **構成を主題に従わせる**: 概要、歴史、図、主張数、テーマ数、まとめを固定枠にしない
7. **証拠を失わない**: 本文の形が変わっても、出典、適用限界、外した調査の枝を残す
8. **形を内容に合わせる**: 推論は段落、独立した列挙は箇条書き、同じ軸の比較は表にする
9. **日本語で探しやすくする**: 見出しは各モデルの読み方に合わせ、`[n]` 引用と視覚的な目印を使う
10. **保存と PR**: `content/docs/` に `index.mdoc` を書き、origin/main ベースの PR を出す（`podcast: none`。マージだけでは TTS は走らない）

**保存先の区別**: `content/web-clips/` は短い Web クリップ・クイックメモ用。本スキルのような**深い調査レポートは `content/docs/` に置く**（Keystatic の Wiki Documents）。

## When to use me

- `/podcast-research2 <テーマ>` の形式で呼び出す
- 例: `/podcast-research2 モジュラー曲線と楕円曲線の関係`
- 既存の `/podcast-research`（固定目次のサーベイ型）と使い分ける。こちらはレポートごとに価値の中心を選び、構成を変える

## Instructions

あなたはポッドキャスト制作用のリサーチエージェントである。調査は広く行い、本文は読者が時間を使う価値の中心へ収束させる。

### 参照ファイル

| 参照 | 役割 | いつ読むか |
|------|------|-----------|
| `references/gravity.md` | 前・中・後の重心選択、混合型、モデル別の構成 | **調査計画の前と、本文を書き始める前に必須** |
| `references/english.md` | 英語の文の作法 | 出力が英語のとき |
| `references/checklists.md` | 共通テストと重心別テスト | 提出前 |
| `measure.py` | 数えられる指標の計測スクリプト | 提出前に必ず実行 |

BLUF、ピラミッド、ダイヤモンド、IMRaD、後部重点は発想の助けにはなるが、同じ水準の理論ではない。名前を根拠に型を選ばず、`references/gravity.md` の三つの質問で選ぶ。

提言、担当者、期限、成功指標は、ユーザーが求め、調査が支える場合だけ書く。前重心を選んだこと自体は提言を書く理由にならない。

### ステップ1: リサーチ計画

テーマを分解し、調査すべきサブトピックを列挙する（最低8〜12項目）。これは**検索計画**であって、完成原稿の目次ではない。

- 概要・定義・歴史的背景
- 核となる概念・理論・仕組み
- 具体例・応用事例
- 重要人物・論文・文献
- 最新の動向・未解決問題
- 隣接する分野との接続

検索を始める前に `references/gravity.md` を読み、次を作業メモへ書く。

1. **問い** — このテーマについて、レポートが答える一文
2. **主な読者の目的** — 判断、比較・探索、妥当性の評価のどれか
3. **読者の前提レベル** — 入門・実務・専門から一つ。指定がなければ入門
4. **既知と未知** — 読者が知っていると仮定する語と、本文で導入する語
5. **代替しにくい成果物** — 統合された答え、比較可能な資料地図、証拠から導く考察のどれか
6. **主重心** — 前・中・後から一つ
7. **副重心** — 必要なら一つ。不要なら「なし」
8. **範囲と除外** — どこまでを確認し、何を扱わないか

続けて、次の一文を書く。

> このレポートは **〈主重心〉**。読者は **〈目的〉** のために読み、価値の中心は **〈具体的な成果物〉** にある。**〈副重心またはなし〉** は導線として置く。

さらに次の一文を書く。

> 読者の前提は **〈入門・実務・専門〉**。**〈既知の概念〉** は説明せず、**〈未知の概念〉** は **〈身近な状況・従来の問題〉** から導入する。

この二文を書けないなら、検索語を増やす前に読者と成果物を決め直す。作業メモは完成原稿へそのまま載せない。

### ステップ2: 徹底的な Web 調査

各サブトピックについて WebSearch と WebFetch を繰り返す。

- **検索は最低15回以上**。日本語・英語の両方で
- 重要なページは WebFetch で全文を取得する
- Wikipedia、arXiv、技術ブログ、公式ドキュメント、一次資料を混ぜる
- 数式・アルゴリズム・定理は正確に記録する
- **出典は取得しながら番号を振っていく。** 本文で `[n]` を使うので、URL・著者・題・日付を対応表にして持つ
- 出典の主張と、このレポート自身の整理とを混ぜない

進捗は都度報告する（「〇〇について調査中…」）。信頼性が低い情報はその旨を残す。

### ステップ3: 構造を決めてから書く

調査ログの順に見出しを増やさない。`references/gravity.md` をもう一度読み、主重心に最も良い資料・紙幅・図表を割り当ててから目次を作る。

**分量の目安: 概要＋本文で2万字程度まで**（長すぎると生成音声が長くなり、コスト増と品質劣化の原因になる）。付録は上限なし。**これは上限側の目安であって、下限ではない。** 2万字に届かせるために主張を増やさない。短く収まるならそれでよい。余ったサブトピックは付録へ移す。

**調査の薄さは字数では測らない。** `measure.py` の「互いに異なる URL」が8本未満なら、テーマを増やすのではなく調査を足す。

構成と見出し階層の正本は `references/gravity.md` である。とくに次を守る。

- タイトル直後に、一項目一文の `## TL;DR` を3〜5項目置く
- `##` は背景・仕組み・制約・運用など読むモードを示し、`###` は具体的な発見・問い・比較対象を示す
- 歴史、図、主張数、まとめを固定枠にせず、主重心を支えるものだけ置く
- 引用は `[n]` で出典一覧へ対応させ、事実・出典の見解・このレポートの解釈を区別する
- 推論は段落、独立した列挙は箇条書き、同じ軸の比較は表、関係は必要な場合だけ図にする
- セッション、スキルの作業語、改訂履歴など、読者の理解に不要な制作過程を本文へ書かない

#### 日本語で書くときの必須事項

出力言語はユーザーの指定がなければ日本語・常体。固有名、論文題、API、ファイルパスは原文のまま。

出力が日本語のとき、**`japanese-writing` スキル**があれば執筆前と推敲前に読み込み、手順に従う。`references/prose-style.md` は使わない（廃止済み）。作業語（「前重心」「価値の中心」など）や制作過程は本文へ出さない。

#### Markdoc

本文は Markdown でよい。数式は `$...$` / `$$`、または `{% math %}`。関係図やフローは `{% diagram type="mermaid" %}`。アーキテクチャ図などは `write-d2-diagram` に従い `{% diagram type="d2" %}` も可。注意書きは `{% callout type="note" %}`（Markdoc タグは `math` / `diagram` / `callout` / `podcastPlayer`）。`podcastPlayer` はスキルから埋め込まない。

**`{% diagram %}` の中身は必ずフェンス付きコードブロックで包む。** 素の行で書くと Markdoc が改行を空白に潰し、Mermaid が構文エラーになって図が出ない。

````markdown
{% diagram type="mermaid" %}
```mermaid
flowchart TD
  A["..."] --> B["..."]
```
{% /diagram %}
````

### ステップ4: content/docs/ に保存して PR を作成する

ユーザーの確認は不要。提出前に次を実行する。

```bash
python3 .agents/skills/podcast-research2/measure.py \
  --model <front|middle|rear> \
  content/docs/<slug>/index.mdoc
```

**共通指標の未達をゼロにしてから進む。出力の数字を書き換えない。** 続けて `references/checklists.md` の共通テストと、選んだ重心のテストを見る。構成は機械判定だけで決めない。

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

- ファイル: content/docs/\$SLUG/index.mdoc
- テーマ: <テーマ>
- スキル: podcast-research2"
     ```

   - `gh` CLI が使えない場合: ブランチ名（`$BRANCH`）をユーザーに伝えて手動で PR 作成するよう案内する

4. 完了メッセージはレポートとは別物。**選んだ読者の前提レベル、主重心とその理由**、価値の中心、見出し一覧、答えの一文、**`measure.py` の出力**を示す。本文をチャットに貼らない
5. 「`content/docs/` に保存して PR を作成しました。main にマージしても自動 ingest / TTS は走りません。」と伝える

### 注意事項

- `content/docs/` ディレクトリは存在しない場合は作成する
- ファイル名のテーマ部分はファイルシステムで安全な文字のみ（スペースはアンダースコア）
- `md` / `markdoc` フェンス内の Markdoc タグは描画されない。図はフェンス外の `{% diagram %}` を使い、生のタグはバッククォートで囲む
- `podcast: queued` にはしない。TTS が必要ならユーザーが明示したときだけ `queued` に変える（既定は `none`）
- このスキルは `podcast-research` を置き換えない。両方残す
