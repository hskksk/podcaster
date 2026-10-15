# treemap.yml

`index.mdoc` と同じディレクトリに置く。UTF-8 YAML。

## ルート

| キー | 型 | 説明 |
|------|-----|------|
| `version` | `1` | スキーマ版 |
| `sourceSha256` | string | frontmatter を除いた本文の SHA-256（小文字 hex）。`extract_nodes.ts` が出力 |
| `nodes` | map | キー = treemap ノード id |

## `nodes.<id>`

| キー | 型 | 説明 |
|------|-----|------|
| `title` | string? | タイル太字の上書き |
| `subtitle` | string? | タイル下段・ツールチップ向け要約 |

少なくとも `title` か `subtitle` の一方が必要（`needsLabel: true` の id）。

## 例

```yaml
version: 1
sourceSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
nodes:
  ch_1:
    subtitle: "全体の問題設定と読み終わったときのゴール"
  p_3:
    title: "RLS を有効化するだけでは足りない"
    subtitle: "service_role 以外のロール向けに insert/select policy が要る理由を整理"
```

## サイト（将来）

`sourceSha256` が現在の本文と一致しない sidecar は無視する（古いラベルで誤表示しない）。
