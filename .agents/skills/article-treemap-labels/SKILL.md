---
name: article-treemap-labels
description: After an index.mdoc exists, build treemap.yml sidecar labels (short titles and subtitles for treemap tiles) from a node manifest. Use when finishing a wiki article or when a parent skill delegates minimap label generation. Returns treemap.yml next to the mdoc.
license: MIT
compatibility: claude-code
allowed-tools:
  - Read
  - Write
  - Bash(pnpm exec tsx scripts/article-treemap/*)
metadata:
  audience: article authors and parent research skills
---

## What I do

`index.mdoc` の **本文は触らない**。同じディレクトリに **`treemap.yml`** を置き、章マップ（treemap ミニマップ）のタイル用ラベルを返す。

## When to use me

- 親スキルが wiki 記事の `index.mdoc` を書き終えた直後（サブエージェント向け）
- ユーザーが章マップ用ラベルの再生成だけを依頼したとき

使わない: 本文の調査・執筆、PR 作成（親スキルの仕事）

## Inputs

親から受け取るもの:

- **`mdocPath`**: `content/docs/<slug>/index.mdoc` など、完成した Markdoc ファイルのパス（1 本）

## Instructions

1. **マニフェストを出す**（ノード id・パス・抜粋・要ラベルフラグ）:

   ```bash
   pnpm exec tsx scripts/article-treemap/extract_nodes.ts "<mdocPath>"
   ```

   標準出力の JSON を正とする。`needsLabel: true` の id はすべて `treemap.yml` に載せる。

2. **スキーマ**は `references/schema.md` を読む。`version: 1`、`sourceSha256`（マニフェストの値をそのまま）、`nodes` を書く。

3. **ラベル付けの規則**

   - 言語は記事本文に合わせる（多くは日本語）。
   - `title`: 地図の太字用。**12〜22 字**目安。見出しノードは既に短ければ `subtitle` だけでもよい。
   - `subtitle`: **40〜80 字**目安。その段落・節の要点。コード塊は「[コード: 言語]」のまま要約してよい。
   - 本文にない事実・数字・固有名詞を足さない。曖昧なら弱い表現にする。
   - パラグラフ葉（`needsLabel: true` で title が一文切り出しっぽいもの）は **必ず** 人が読める `title` か `subtitle` を付ける。

4. **保存**: `<mdoc のディレクトリ>/treemap.yml` に書く（`index.mdoc` と同階層）。

5. **検証**（未達なら直してから終える）:

   ```bash
   pnpm exec tsx scripts/article-treemap/validate_treemap.ts "<mdocPath>"
   ```

   終了コード 0 で完了。

## Output

- 成果物: 記事ディレクトリの **`treemap.yml`**
- 親エージェントへ: 検証コマンドが通ったこと、ラベルしたノード数の一行だけ（YAML 全文をチャットに貼らない）

## Notes

- `scripts/article-treemap/build_sidecar.ts` は機械バックフィル用。**2文目以降を subtitle にするだけ**で、要約の代わりにはならない。新規記事はこのスキルで書く。
- 本文を直したあとは **必ず** マニフェストを再実行し、`sourceSha256` とノード id を揃え直す。
- `@hskksk/markdoc-react` の treemap パーサと同じ id 規則に依存する。パッケージのメジャー変更時は sidecar を再生成する。
