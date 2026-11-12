# Article Visual spec v1（執筆用）

正本は `@hskksk/markdoc-react/section-visual` の parser と同じ。ここは執筆チェック用の要約。

## 共通（すべての spec）

| キー | 必須 | 説明 |
| --- | --- | --- |
| `type` | yes | 下表のいずれか |
| `title` | yes | **takeaway headline** — 図が伝える主張の一行（見出しの転載・節の要約文ではない） |
| `caption` | no | 読み方の短い補足 |

各 `label` は短い名詞句・動詞句。`detail` は一文以内。`emphasis` は 1 図につき最大 2 件。`icon` は任意（`person` `document` `database` `shield` `timer` `workspace` `service` `network` `chart` のみ）。

**入れない**: 色・座標・class・URL・HTML・SVG path。

## type 別（項目数は上限）

| type | 用途 | 主なフィールド |
| --- | --- | --- |
| `cards` | 並列の要点 | `items` 2–6 |
| `sequence` | 順序・段階 | `mode`: `steps` \| `timeline` \| `funnel`、`items` 3–7 |
| `interaction` | 者間のやりとり | `actors` 2–4、`steps` 2–8 |
| `comparison` | 二者比較 | `sides` 2 件、各 `items` 2–5。同じ行は同じ観点（`detail`＝中央の比較軸ラベル） |
| `hierarchy` | 包含・構成 | `root` ツリー、深さ 4・ノード計 12 まで |
| `flow` | 因果・依存（DAG） | `nodes` 3–9、`edges` 2–12 |
| `matrix` | 2 軸の位置づけ | `xAxis`/`yAxis` の `low`/`high`、`items[].quadrant` |
| `chart` | 本文に明示された数量 | `variant` `bar` \| `line` \| `donut`、`values` 2–8 |

`chart` は本文に同じ数値と単位がない場合は作らない。

## envelope

ルート: `version: 1`、`sourceSha256`（frontmatter 除く本文の SHA-256）、`visuals`（非空配列）。各 visual: `sectionId`、`engine: article-visual`、`engineVersion: "1"`、`alt`、`spec`。
