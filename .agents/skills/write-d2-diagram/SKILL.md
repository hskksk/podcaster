---
name: write-d2-diagram
description: D2 図の執筆規約と Markdoc への埋め込み方、検証ループ（pnpm d2:check）。このリポジトリではブラウザ描画に @terrastruct/d2 を使う。アーキテクチャ図・ER・VSM など Mermaid より D2 が向く図を書くときに使う。
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

### 1. レイアウトエンジン

ファイル先頭の `vars: { d2-config: { ... } }` で指定する。標準は `elk`（`dagre` より整いやすい）。

```
vars: {
  d2-config: {
    layout-engine: elk
  }
}
```

`layout-engine` を変えるのは、図の分割・ラベル短縮・構造の修正でも `pnpm d2:check` の警告が消えず、**エンジン差し替えだけで改善するとき**だけ。

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

誤った書き方は **コンパイルエラーにならない**。ルートに同じ名前の新ノードが作られ、コンテナの中は孤立したままになる（`pnpm d2:check` の `isolated shape` で検出する）。

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

書いた D2 はマージ前に **`pnpm d2:check` を通し、末尾が `warnings: none` になるまで直して再実行する**。Web と同じ WASM エンジン `@terrastruct/d2` で、コンパイル + ASCII 構造プレビュー + レイアウト自己点検を 1 コマンドで行う。

```bash
# 主手順: コンパイル + ASCII プレビュー + 警告
pnpm d2:check path/to/diagram.d2

# Markdoc のフェンス内ソースをそのまま検証する
pnpm d2:check - <<'EOF'
vars: { d2-config: { layout-engine: elk } }
a -> b: 変換
EOF

# 構文だけ早送り（位置付きでエラーが出る）
pnpm d2:validate path/to/diagram.d2
```

3 つのステップ:

1. **コンパイル** — 構文エラーは `path:line:col: メッセージ` + 該当行と `^` で出る。位置が分かるのでそのまま直せる。
2. **ASCII 構造プレビュー** — **ラベルが本文の主張と合っているか、コンテナの中にノードがあるか、矢印が切れていないか**をここで読む。コンパイルが通っても構造が破綻する図はこれで判る。
   - `title: |md` ブロックは ASCII では**空の箱**として出る（markdown を描画できないため）。壊れたノードではない。
   - 日本語ラベルは全角グリッドで描かれる。隣り合うラベルが横幅で重なることがあるが、**構造の問題ではない**。折り返し位置は気にしない（ASCII は構造用で、組版用ではない）。
3. **レイアウト自己点検** — 下列の警告を全部消す。消せないものは本文の分割かラベル短縮で対処する。

```
layout: 1543x548px (article column 768px -> 50%), shapes 15, edges 8, depth 2
warnings (4):
  - width 1543px > 768px: 本文では 50% に縮尺されラベルが読めなくなる
  - fan-out 6 > 4 from hub: 集約ノードを挟む
  - label width 50 > 24: hub -> a "とても長いエッジラベル" — 短い語に置き換える
  - isolated shape container.raw (level 2): 意図がなければ接続不足 — コンテナ内ノードの参照は完全修飾名で書く
```

### 9.1 図の予算（警告の根拠）

公開記事の図は **本文カラム幅 768px** に幅合わせで SVG が縮小される（高さ方向の細長さは問題にならない）。主な失敗は「幅が大きすぎてラベルが読めなくなる」こと。

| 予算 | 既定 | 根拠 / 対処 |
|------|------|-------------|
| 幅 | 768px | これを超えると 16px のラベルが本文幅に収まらず縮尺される。図を分けるか、列を畳む |
| 入れ子深さ | 3 | 4 段は ELK でも配置が不安定。フラットに落とす |
| fan-out | 4 | 1 ノードから 5 本以上出ると放射状になり矢印が交差する。集約ノードを挟む |
| ラベル幅 | 24 | 全角 2 文字として数える。日本語は 12 文字程度。長い説明は本文に逃がす |
| ノード数 | 40 / エッジ 60 | これ以上は 1 枚に収まらない |

予算は引数で緩くできる（例: `pnpm d2:check diagram.d2 --max-width 1100 --max-label 32`）。全オプションは `--help`。

### 9.2 ASCII で分かる壊れ方

- コンテナの中にいるはずのノードが、コンテナの外にもう 1 個ある → §4 の修飾名忘れ。`isolated shape` の警告とセットになる。
- 矢印が箱の端で止まって宙に浮く → コンテナの範囲が足りない、または兄弟コンテナが重なっている。
- 1 つの `sql_table` にカラムが 10 個並ぶ → ER 図としては大きすぎる。論点ごとに図を分けるか、その項目を 1 ノードに畳む。

### 9.3 組版の確認（任意）

構造と警告の確認は §9 の ASCII + 自己点検で足りる。**ラベルの見え方・日本語組版**を確認するときだけ `--svg` で書き出し、ブラウザで開く（PNG へのラスタライズはエージェント環境では日本語が読めないので使わない）。

```bash
pnpm d2:check path/to/diagram.d2 --svg /tmp/preview.svg
```

`d2` CLI（`brew install d2`）が PATH にあればローカルでも同じソースを検証できるが、**このリポジトリの正規経路は `pnpm d2:check` / `pnpm d2:validate` / `pnpm d2:render`** である。

### 10. ドキュメント横断の一貫性

図中の数値・期間・セグメント名・確信度ラベルは本文と矛盾させない。本文を直したら `.d2` のラベルも直し、`pnpm d2:check` をもう一度回す。

## 詳細

- 自己点検スクリプト: `scripts/d2-check.ts`（共有処理は `scripts/lib/d2.ts`、予算は `--max-*`）
- Markdoc タグ: `apps/web/markdoc/config.ts`（`@hskksk/markdoc-react/server` の built-in）+ `extensions.ts`（`podcastPlayer`）
- 描画: サーバ `prepareMarkdoc` → `MarkdocArticleBody`（`MarkdocContent` を dynamic import、D2/Mermaid/Shiki）
