---
name: write-d2-diagram
description: D2 図の執筆規約と Markdoc への埋め込み方。このリポジトリではブラウザ描画に @terrastruct/d2 を使う。アーキテクチャ図・ER・VSM など Mermaid より D2 が向く図を書くときに使う。
license: MIT
compatibility: claude-code
metadata:
  audience: wiki and web-clip authors
---

## When to use me

- アーキテクチャ図、ER、コンテナ階層、値流れ（VSM）など **ノードとコンテナが多い図**
- `podcast-research2` の主張マップ型 Mermaid テンプレート **以外** の概観図（主張マップは `podcast-research2` の Mermaid 規約のまま）

他スキルで図を書く前に、D2 を選ぶなら **このスキルを読んでから** ソースを書く。

## Markdoc への埋め込み（このリポジトリ）

公開サイト・Keystatic は `{% diagram %}` タグと `Diagram` コンポーネントで **Mermaid と D2** の両方を描画する。

**中身は必ずフェンス付きコードブロックで包む。** 素の行だと Markdoc が改行を空白に潰し、コンパイルエラーになる。

````markdown
{% diagram type="d2" %}
```d2
vars: {
  d2-config: { layout-engine: elk }
}

title: |md
  # 図のタイトル
| {near: top-center}

a -> b: 関係
```
{% /diagram %}
````

本文中の ```d2 フェンスだけでも描画される（`markdownToMdoc` 経由では `{% diagram type="d2" %}` に変換される）。

## D2 執筆規約

（`hskksk/prism-data-labs-agent` の `write-d2-diagram` を Podcaster 向けに移植。Opencode 専用ツールの記述は CLI / `pnpm d2:*` に置き換え。）

### 1. レイアウトエンジン

ファイル先頭の `vars: { d2-config: { ... } }` で指定する。標準は `elk`（`dagre` より整いやすい）。

```
vars: {
  d2-config: {
    layout-engine: elk
  }
}
```

### 2. タイトル

`near: top-center` 付き markdown ブロックを使う。プレーン `title: 文字列` は使わない。

```
title: |md
  # 図タイトル
| {near: top-center}
```

### 3. 凡例

手書きの `legend: Legend { ... }` コンテナは作らない。`vars.d2-legend` でスタイルと凡例ラベルを定義する。

### 4. コンテナ内ノードの参照（重要）

コンテナ **外** からコンテナ **内** のノードを指すときは、必ず `コンテナ名.ノード名` の完全修飾名を使う。

正: `tier0.raw -> tier1.frame`  
誤: `raw -> frame`（切り離されて見える）

**同じコンテナ内** で、かつ矢印も同じスコープ内なら短い名前でよい。

### 5. エッジの線種

- 実線: 確定した関係
- `style.stroke-dash: 3`: 推論
- `style.stroke-dash: 5`: 仮定・不確か

情報フロー（物質フローと区別）例:

```
style.stroke: "#1565C0"
style.stroke-dash: 5
```

### 6. よく使う shape

| shape | 用途 |
|-------|------|
| `sql_table` | ER |
| `queue` | 在庫 / WIP（VSM） |
| `cloud` | 外部（サプライヤ等） |
| `oval` | 顧客 |
| `rectangle` | プロセス |

### 7. ラベルで避ける文字

D2 が構文と解釈するため、ラベル内では避ける:

- `$`（代わりに USD 等）
- `()`（代わりに `-` や言い換え）
- 文脈によって問題になる `\n`（複数行は引用符ラベル）

### 8. 出力言語

ノード ID は英数字の識別子のまま。**表示ラベル・タイトル・凡例・エッジラベル** は記事の読者向け言語（多くは日本語）に合わせる。

### 9. 検証とプレビュー

書いた D2 はマージ前にコンパイル確認する（Web と同じ WASM エンジン `@terrastruct/d2`）。

```bash
# ファイル
pnpm d2:validate path/to/diagram.d2

# 標準入力
pnpm d2:validate - <<'EOF'
x -> y
EOF

# SVG プレビュー（任意）
pnpm d2:render path/to/diagram.d2 /tmp/preview.svg
```

Markdoc に直接書いた場合は、一度 `.d2` に抜き出して検証するか、フェンス内ソースをそのまま stdin に渡す。

`d2` CLI（`brew install d2`）が PATH にあればローカルでも同じソースを検証できるが、**このリポジトリの正規経路は `pnpm d2:validate` / `pnpm d2:render`** である。

### 10. ドキュメント横断の一貫性

図中の数値・期間・セグメント名・確信度ラベルは本文と矛盾させない。本文を直したら `.d2` のラベルも直し、再検証する。

## 詳細

- Markdoc タグ一覧: `apps/web/markdoc/tags.ts`（`diagram`）
- 描画: `apps/web/components/markdoc/Diagram.tsx`
