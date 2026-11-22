---
name: kokugo-choice-drill
description: 中学受験国語（首都圏の上位校〜難関校）の選択肢問題を作り、サイトの /juken/kokugo-choice に公開する。消去法トレーニング用に、紛らわしい選択肢ごとに誤答タイプと本文の根拠を付けて作問し、別コンテキストで解かせて検証した問題だけを採用する。Use when creating a set of Japanese multiple-choice reading questions for juken.
license: MIT
compatibility: claude-code
metadata:
  audience: 中学受験国語の選択肢問題の家庭学習
---

## What I do

短い文章の選択肢問題を作り、検証して、`chugaku-juken/kokugo-choice/sets/<セットID>/` に保存する。サイトの `/juken/kokugo-choice` が、本文を読み、選択肢を選び、まちがいの選択肢を ✕ で消し、答え合わせで誤りの理由と本文の根拠を見る画面として表示する。

- 作るのは「消去法で解く力」を鍛える問題。選択肢は微妙に紛らわしいが、正解は解釈の差ではなく本文の根拠だけで 1 つに決まる
- 本文は完全自作（`mode=generate`、約 8 割）と青空文庫の抜粋（`mode=excerpt`、約 2 割）
- 誤答の集計・記録はしない。誤答タイプは、答え合わせで子どもに見せるラベルとして使う

## When to use me

- `/kokugo-choice-drill` または「国語の選択肢問題を作って」「消去法の問題集を作って」
- 問題数、genre、level、題材を指定できる。なければ 10 問、`references/workflow.md` の配分で作る

## Instructions

このスキルと参照ファイルだけで作る。日本語ライティングや文章推敲の別スキルが入っていても、混ぜない。作問の文章規約は `references/author-prompt.md` が唯一の基準。

### 参照ファイル

| 参照 | 役割 | いつ読むか |
|------|------|-----------|
| `references/workflow.md` | 保存先、1 問の JSON、配分、題材と文体の振り分け、青空文庫の扱い、手順、提示 | **作り始める前に必須** |
| `references/author-prompt.md` | 作問プロンプト（入力、本文、選択肢、誤答タイプ、難易度、自己検証、出力） | **1 問ごとの作問前に必須** |
| `references/verify-prompt.md` | 検証プロンプトと採否の基準 | **検証の前に必須** |

### 流れ

1. **割り当てる**: 問題数・配分・各問の入力（genre / mode / level / question_type / answer_position / theme / style）を決める。既存セットの `theme` と `style` と重ならないようにする
2. **作る**: 1 問ずつ `author-prompt.md` に従って JSON を書き、`qNN.json` に保存する。`excerpt` は青空文庫のファイルを取得して本文を取る
3. **形式を確かめる**: `pnpm juken:check-drills`。エラーは直す。警告も直せるなら直す
4. **別コンテキストで解かせる**: 問題ごとにサブエージェントを起動し、`passage`・`question`・`choices` だけを渡して `verify-prompt.md` のプロンプトで解かせる。答えと解説は渡さない。同じコンテキストで自分の問題を解き直して検証にしない
5. **採否を決める**: `verify-prompt.md` の基準で採否を決める。不採用は直すか、作り直す
6. **セットを見直す**: 配分、正解位置、題材の重なりを見る。`level 3` と気持ちの問題は、人が確認しやすいように提示で名指しする
7. **サイトで確かめる**: `pnpm web:dev` で `/juken/kokugo-choice/<セットID>` を開き、選択、✕、答え合わせ、「本文で見る」が動くことを確かめる

サブエージェントを起動できない環境では、検証を実行できなかったと提示で書く。その問題を採用済みとして扱わない。

### リポジトリに残す場合

ユーザーが求めたとき、またはクラウドで PR まで進める運用のときは、ブランチを切ってコミットし、PR を出す。コミットと PR タイトルは Conventional Commits にする（例: `feat(juken): add kokugo choice drill set 2026-11-22-01`）。

## 成果物

- `chugaku-juken/kokugo-choice/sets/<セットID>/q01.json …`
- 公開 URL `/juken/kokugo-choice/<セットID>`
- 提示: パス、URL、問題ごとの属性表、不採用にした問題と理由
