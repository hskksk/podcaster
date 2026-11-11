---
name: article-section-visuals
description: After index.mdoc exists, author section-visuals.yml (Article Visual spec v1 per section) from a section manifest and the article body. Use in the same run as the article author (e.g. podcast-research2 after treemap), not via a subagent. Returns section-visuals.yml next to the mdoc.
license: MIT
compatibility: claude-code
allowed-tools:
  - Read
  - Write
  - Bash(pnpm section-visuals:extract *)
  - Bash(pnpm section-visuals:validate *)
metadata:
  audience: article authors and parent research skills
---

## What I do

`index.mdoc` の **本文は触らない**。同じディレクトリに **`section-visuals.yml`** を置き、読者が現在のセクションの主張・関係を短時間で把握できる **Article Visual spec** を書く。図の種類（`type`）と構造化 payload だけを書き、HTML・SVG・座標・色は書かない。

## When to use me

- **記事を書いた同じエージェント**が `index.mdoc` を保存した直後（親スキルでは `treemap.yml` の直後）
- ユーザーが既存記事のセクション図 sidecar だけ再生成を依頼したとき

委譲しない。`web-clips` や短い clip は初期対象外（親が依頼したときだけ）。

## What you must not do

- React・Markdoc タグ・`apps/web` の配置をスキルに書き込まない（spec v1 と検証だけ）
- 本文にない事実・数字・因果・固有名詞を spec に足さない
- 見出しの転載だけの図（情報が増えない cards）を作らない
- 1 記事 **8 枚** を超える（初期上限）
- 検証以外の Bash を増やさない

## Inputs

- **`mdocPath`**: いま書き終えた `content/docs/<slug>/index.mdoc`

## Instructions

1. **セクション manifest**（見出し id・行範囲・本文スライス・`sourceSha256`）:

   ```bash
   pnpm section-visuals:extract "<mdocPath>"
   ```

   JSON の `sections` と `sourceSha256` を正とする。`sectionId` は各 visual の `sectionId` にそのまま使う（見出し文字列ではなく id）。

2. **候補の選定**（`references/selection.md`）: 内容のある H2 を基本。`TL;DR`・概要だけの導入・まとめ・出典・付録は原則除外。H3 は親 H2 の図では表えない独立した仕組み・比較・時系列だけ。

3. **各候補**で主張を一つに絞り、本文の関係から `type` を一つ選ぶ（`references/type-map.md`）。`spec.title` は結論を短く書く（見出しのコピー禁止）。

4. **`spec` を書く**（`references/spec-v1.md`）。`engine: article-visual`、`engineVersion: "1"`。各 visual に根拠の一文 `alt`（スクリーンリーダー用）。

5. **envelope** を同ディレクトリの `section-visuals.yml` に保存:

   ```yaml
   version: 1
   sourceSha256: "<manifest の値>"
   visuals:
     - sectionId: "<id>"
       engine: article-visual
       engineVersion: "1"
       alt: "..."
       spec: { type: ..., title: ..., ... }
   ```

   `visuals` は空配列不可。`sectionId` は重複不可。

6. 対象セクション本文と **固有名詞・数値・単位・因果** を目視照合する。

7. **検証**（0 になるまで YAML を直す）:

   ```bash
   pnpm section-visuals:validate "<mdocPath>"
   ```

## Output

- 成果物: 記事ディレクトリの **`section-visuals.yml`**
- 続けて親スキルの PR へ。チャットには検証 OK と visual 数・使った `type` の数だけ（YAML 全文は貼らない）

## Notes

- 本文を直したあとは manifest を再実行し、`sourceSha256` と sidecar 全体を揃え直す。
- 設計の背景は `docs/architecture/article-section-visuals.md`。実装ステータスは `scripts/article-section-visuals/README.md`。
