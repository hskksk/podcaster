---
name: article-treemap-labels
description: After an index.mdoc exists, author treemap.yml sidecar (tile labels plus inferred-style links between nodes) from a node manifest and the article body. Use when finishing a wiki article or when a parent skill delegates minimap generation. Returns treemap.yml next to the mdoc.
license: MIT
compatibility: claude-code
allowed-tools:
  - Read
  - Write
  - Bash(pnpm exec tsx scripts/article-treemap/extract_nodes.ts *)
  - Bash(pnpm exec tsx scripts/article-treemap/validate_treemap.ts *)
metadata:
  audience: article authors and parent research skills
---

## What I do

`index.mdoc` の **本文は触らない**。同じディレクトリに **`treemap.yml`** を置き、章マップ（treemap ミニマップ）の **タイルラベル** と **ノード間リンク**（本番で LLM が推定していた `inferLinks` / `labelChapterFlow` の代替）を **自分で考えて** 書く。

## When to use me

- 親スキルが wiki 記事の `index.mdoc` を書き終えた直後（サブエージェント向け）
- ユーザーが章マップ用 sidecar の再生成だけを依頼したとき

使わない: 本文の調査・執筆、PR 作成（親スキルの仕事）

## What you must not do

- **`scripts/article-treemap/_dev/`**（`build_sidecar` など）を実行して YAML を機械生成しない。要約・リンクの品質はここで決める。
- 親見出しのコピーや、先頭 28 字の言い換えだけで済ませない。
- 検証以外の目的で Bash を増やさない（許可は `extract_nodes` と `validate_treemap` のみ）。

## Inputs

親から受け取るもの:

- **`mdocPath`**: `content/docs/<slug>/index.mdoc` など、完成した Markdoc ファイルのパス（1 本）

## Instructions

1. **マニフェストを出す**（ノード id・パス・抜粋・章一覧・リンク型の説明）:

   ```bash
   pnpm exec tsx scripts/article-treemap/extract_nodes.ts "<mdocPath>"
   ```

   標準出力の JSON を正とする。`needsLabel: true` の id はすべて `treemap.yml` の `nodes` に載せる。`chapters`・`orderedNodeIds`・`linkTypes` はリンク設計用。

2. **本文を読む**: マニフェストの `excerpt` は手がかり。各 `needsLabel` ノードは **`index.mdoc` の該当段落**を読み、タイル用の言い回しを決める（機械スクリプトに任せない）。

3. **スキーマ**は `references/schema.md` を読む。`version: 1`、`sourceSha256`（マニフェストの値をそのまま）、`nodes`、推奨で `links` と `chapterFlow` を書く。

4. **ラベル付けの規則**

   - 言語は記事本文に合わせる（多くは日本語）。
   - **パラグラフ葉は 1 段落 = 1 組のラベル**。同じ節見出しを複数タイルの `title` に繰り返さない（検証で duplicate title はエラー）。
   - `title`: その段落だけを表す **短い一文**（**12〜24 字**目安）。親見出しのコピー禁止。
   - `subtitle`: 同じ段落の要点を **80〜110 字**目安。`title` と同文の繰り返しにしない。
   - コード塊は `title` を「図（mermaid）」などにし、`subtitle` で何を示すか要約してよい。
   - 本文にない事実・数字・固有名詞を足さない。曖昧なら弱い表現にする。
   - `needsLabel: true` の id には `title` と `subtitle` の **両方** を入れる（パラグラフ葉）。

5. **リンクの規則**（`markdoc-react` の `inferLinks` と同じ型）

   - マニフェストの `linkTypes`（`scripts/article-treemap/link-types.ts` と同内容）を参照し、**本文の論理関係に合う型**だけ使う。
   - 各要素: `from` / `to`（ノード id）、`type`（必須）。任意で `label`（矢印の短い説明）、`reason`（根拠の一言）。
   - **全体で最大 30 本**（レンダラの表示上限）。優先度の高い関係から入れ、無理に埋めない。
   - 章ノード（`chapters[].id`）間は `flow` で読み順の骨格をつなぐ。章内は `seq`・`cause`・`evidence` など、読者が地図で辿りたい筋だけ。
   - `explicitLinks` がマニフェストにあれば sidecar に反映する。
   - **`chapterFlow`**: 章の数 − 1 個の短い文字列（**〜48 字**）。`chapters` の並びに対応。

6. **保存**: `<mdoc のディレクトリ>/treemap.yml` に書く（`index.mdoc` と同階層）。

7. **検証**（未達なら YAML を直して再実行）:

   ```bash
   pnpm exec tsx scripts/article-treemap/validate_treemap.ts "<mdocPath>"
   ```

   終了コード 0 で完了。

## Output

- 成果物: 記事ディレクトリの **`treemap.yml`**
- 親エージェントへ: 検証が通ったこと、ラベルしたノード数とリンク本数の一行だけ（YAML 全文をチャットに貼らない）

## Notes

- 本文を直したあとは **必ず** `extract_nodes` を再実行し、`sourceSha256` とノード id・リンクの from/to を揃え直す。
- `@hskksk/markdoc-react` の treemap パーサと同じ id 規則に依存する。パッケージのメジャー変更時は sidecar を再執筆する。
