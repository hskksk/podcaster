# pros_cons — 執筆ルール

称賛・懸念・賛否・二極化など、**左右でバラばらに並ぶ要点**向け。`comparison`（同行に同じ `axis`）は使わない。

## いつ使うか

- 世論・レビュー・コミュニティ反応
- pro/con が **1 対 1 で対応しない**
- 左右の件数が違ってよい

## `label` の書き方

- **観点・設計・結果**を書く。製品名・内部コード名だけを置かない。
- 本文が「Gatekeeper ＋ デフォルト拒否が筋がいい」と言っているなら、label は **筋のいい権限設計**（Gatekeeper は alt や本文に任せる）。
- 本文が「Gadget がチャットではなく動くアプリ」と言っているなら **動く社内アプリ**。
- 懸念で **名称そのもの**が争点なら **「OS」名の誤解**のように、名前＋論点にする（名称だけの羅列は禁止）。
- 各 `items[].label` は短い名詞句（おおよそ 4〜16 字）。`detail` は原則使わない（図に載るのは label のみ）。

## 悪い例

```yaml
- label: Gatekeeper
- label: Gadget
```

## よい例

```yaml
sides:
  - label: 称賛
    items:
      - label: 筋のいい権限設計
      - label: 動く社内アプリ
  - label: 懸念
    items:
      - label: 「OS」名の誤解
      - label: Cloudflare依存
```

## spec 形

`sides` 2 件、各 `items` 2〜5。左右の行数は一致させない。
