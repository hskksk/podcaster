# セットの組み立て・保存・公開

## 保存先

```
chugaku-juken/kokugo-choice/sets/<YYYY-MM-DD>-<NN>/q01.json … qNN.json
```

- セット ID は作成日と、その日の通し番号（`2026-11-22-01`）。サイトの見出しは「2026年11月22日 第1回」になる
- 1 問 1 ファイル。ファイル名は `q01.json` から連番。サイトはファイル名順に「問1、問2…」と出す
- 塾・コースの木（`<塾>/<コース>/weeks/`）とは別系統。公開 URL は `/juken/kokugo-choice` と `/juken/kokugo-choice/<セットID>`
- 追加のあとにサイト側の作業は要らない。ビルド時にディレクトリを読む

## 1 問の JSON

`references/author-prompt.md` の出力から `unusable_reason` を除いたもの。

| キー | 内容 |
|------|------|
| `mode` | `generate` / `excerpt` |
| `genre` | `説明文` / `随筆` / `小説` |
| `level` | `1` / `2` / `3`（数値） |
| `question_type` | `理由` / `気持ち` / `気持ちの変化` / `内容合致` / `筆者の考え` / `言い換え` |
| `theme` | 題材。次のセットで重複させないための記録 |
| `style` | 人称・時制・視点など。同上 |
| `passage` | 本文。傍線部は `**…**` を 1 か所 |
| `source` | `generate` は `自作`。`excerpt` は作品名・作者・底本 |
| `question` | 設問文 |
| `choices` | `ア`〜`エ` |
| `answer` | `ア`〜`エ` |
| `choice_analysis` | 選択肢ごとに `verdict`（○/×）・`error_type`（A〜M、○は null）・`defect`（○は null）・`evidence` |
| `elimination_steps` | 消去の順序 2〜3 文 |

サイトの答え合わせは、`error_type` を短いラベル（言い過ぎ・部分ズレなど）にして、`defect` と `evidence` とともに各選択肢に出す。`evidence` は「本文で見る」で本文上に強調される。誤答タイプの集計・記録は行わない。

## チェック

```bash
pnpm juken:check-drills
```

`pnpm typecheck` にも含まれる。エラーは公開ビルドも止める。

- エラー: 形式の誤り、`answer` と ○ の不一致、`evidence` が本文にない、傍線部が 1 か所でない、気持ちの設問に傍線部がない、`generate` の字数が範囲外、`source` と `mode` の不整合
- 警告: 選択肢の長さの差が 1.3 倍超、`evidence` が 30 字超、正解位置の偏り、題材の重複

警告は、直せるなら直す。このチェックは形式だけを見る。本文だけで正解が決まるかは検証プロンプトで確かめる。

## 10 問セットの配分

問題数はユーザーの指定に従う。指定がなければ 10 問にする。10 問のときの目安:

| 項目 | 配分 |
|------|------|
| genre | 説明文 5 / 随筆 1 / 小説 4 |
| mode | `generate` 8 / `excerpt` 2（`excerpt` は随筆・小説から） |
| level | 1 が 3 / 2 が 4 / 3 が 3 |
| answer_position | ア〜エを 2〜3 回ずつ。連続させない |

10 問以外のときは、この比率に近づける。

### genre ごとの question_type

| genre | 使う question_type |
|-------|--------------------|
| 説明文 | 理由 / 内容合致 / 筆者の考え / 言い換え |
| 随筆 | 気持ち / 筆者の考え / 理由 / 内容合致 |
| 小説 | 気持ち / 気持ちの変化 / 理由 / 内容合致 |

同じセットで同じ question_type が続かないようにする。

### 題材と文体

- 既存セットの `theme` と `style` を読み、同じ題材と同じ形の文体を避ける: `rg '"(theme|style)"' chugaku-juken/kokugo-choice/sets`
- セット内でも、問題ごとに `theme` と `style`（一人称／三人称、過去形／現在形、語り手の視点）を変える
- 説明文の題材は、事実を確実に言えるものにする

## mode=excerpt（青空文庫の抜粋）

- 青空文庫に載っている作品だけを使う。図書カードで、著作権が切れて公開されていることを確かめる
- 本文は青空文庫のファイルを取得して、そこから抜き出す。記憶から書き起こさない。取得できなければ `excerpt` は作らず、その分を `generate` にする
- 連続した 200〜400 字ほどを、文の切れ目から切れ目まで取る
- ルビ（`《》`）と入力者注（`［＃…］`）だけを取り除く。字句・仮名遣い・句読点は変えない
- `source` は `作品名（作者）青空文庫 図書カードNo.<番号>` の形で書く
- 本文だけで一意に決まる設問が作れなければ、別の箇所か別の作品に替える

## 手順

1. 問題数と配分を決め、問ごとに genre・mode・level・question_type・answer_position・theme・style を割り当てる
2. 既存セットの `theme` / `style` を確かめて、重複を避ける
3. `references/author-prompt.md` に従って 1 問ずつ作る。一時ファイルに書き、`qNN.json` として保存する
4. `pnpm juken:check-drills` を通す
5. `references/verify-prompt.md` に従って、問題ごとに別コンテキストのサブエージェントで検証し、採否を決める
6. 不採用の問題は直して再検証し、直らなければ作り直す
7. セット全体を見直す: 配分、正解位置、題材の重なり、`level 3` と気持ちの問題の読み直し
8. サイトで確かめる: `pnpm web:dev` を起動して `/juken/kokugo-choice/<セットID>` を開く

## 提示

- 保存したセットのパス、公開 URL（`/juken/kokugo-choice/<セットID>`）、問題ごとの genre / level / question_type / 正解位置を表で示す
- 不採用にした問題と、その理由を書く
- 検証を実行できなかった問題は「未検証」と明記し、採用済みとして扱わない
