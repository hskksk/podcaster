# 章マップラベル（`treemap.yml`）

公開記事の treemap ミニマップでは、パラグラフ葉の **太字タイトルが一文目の先頭 28 字**になり、地図として読みにくい。本番ではノード間リンクも LLM が推定するが、ビルド時は **同ディレクトリの sidecar** でタイル用ラベルとリンクを持つ。

## 原則

- 知識の正は `index.mdoc` の本文。要約は **メタデータ**（`treemap.yml`）だけ。
- 生成は **記事作成スキルの最終段**（サブエージェント）。CI や `next build` では走らせない。
- サイトはビルド時に sidecar を読むだけ（`loadTreemapLabels` → `ArticleMinimapLayout`）。`markdoc-react` に同期 `labels` が無い間は DOM でタイルに反映する。

## ファイル配置

```
content/docs/<slug>/
  index.mdoc      # 既存
  treemap.yml     # 章マップ用ラベル + リンク（新規）
```

`content/web-clips/` でも同じ名前を使える。長文 wiki（`podcast-research2`）では **必須**。短いクリップでは省略可。

## スキーマ（`treemap.yml`）

```yaml
version: 1
# Markdoc 本文（frontmatter 除く）の SHA-256 十六進。本文変更後は再生成。
sourceSha256: "a1b2c3…"
nodes:
  s_abc12:
    title: "12〜20字の短いラベル"      # 任意。太字を上書き
    subtitle: "40〜80字の要約。本文にない主張は書かない"
  p_def34:
    subtitle: "パラグラフ箱向けの要約だけでも可"
links:
  - from: ch_1
    to: ch_2
    type: flow
chapterFlow:
  - "→ 次の章の短いラベル"
```

- **キー**は `@hskksk/markdoc-react` の `parseTreemapDocument` が付けるノード `id`（`extract_nodes` の出力と一致させる）。
- **必須フィールド**: ルートの `version`, `sourceSha256`, `nodes`。
- **任意**: `links`（最大 30 本、`inferLinks` と同じ型）、`chapterFlow`（章数 − 1 要素）。
- **葉ノード**で `needsLabel: true` と出た id には、`title` または `subtitle` の少なくとも一方を入れる（検証スクリプトが確認）。

## ワークフロー

1. 親スキル（例: `podcast-research2`）が `index.mdoc` を書き終える。
2. **サブエージェント**に `article-treemap-labels` を読ませ、同じディレクトリに `treemap.yml` を作る。
3. 親が `git add` して PR（mdoc + yml を同コミット）。

サブエージェントは軽量モデルでよい。入力は `extract_nodes` の JSON と本文抜粋だけ。

## サイト側

1. `loadTreemapSidecar(collection, dir, renderSource)` — `content/{collection}/{dir}/treemap.yml`（無ければ `null`）。`loadTreemapLabels` は nodes だけの互換ラッパ。
2. `sourceSha256` が **レンダー用本文**または **ディスク上の `index.mdoc` 本文**のどちらかと一致しないときは警告し、sidecar を無視する。
3. `createStaticTreemapAi` — `describeNodes`（ラベル）、`inferLinks`（`links`）、`labelChapterFlow`（`chapterFlow`）。`ArticleMinimapLayout` の `title` はマウント後の短い再適用のみ（treemap の再描画と競合しない）。

## 関連

- スキル: `.agents/skills/article-treemap-labels/`
- スクリプト: `pnpm exec tsx scripts/article-treemap/extract_nodes.ts` / `validate_treemap.ts`
- 呼び出し: `.agents/skills/podcast-research2/SKILL.md` ステップ 3b
