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
- 問題のあいだに、ぬいぐるみ（ぴー）たちの「ひとやすみ」を置く。応援、関係ない話、好きなものの話、遊び。問題文と選択肢には登場させない

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
| `references/interlude.md` | ひとやすみ（`intro.mdoc` / `after-qNN.mdoc`）の置き方と規約 | **ひとやすみを書く前に必須** |

ひとやすみの会話を書く前に、`sapix-grade5-history-weekly` スキルを読む。9 人のキャラクター設定と口調はそこに従う。歴史の授業としての構成の規則は、このスキルでは使わない。

### タグ（各問題の JSON）

| タグ | キー | 画面での表示 |
|------|------|--------------|
| ジャンル | `genre` | 説明文 / 随筆 / 小説 |
| 難易度 | `level` | レベル1〜3 |
| 設問の型 | `question_type` | 理由 / 気持ち / … |
| 本文の出所 | `mode` | 自作 / 抜粋 |
| 題材・文体 | `theme` / `style` | 一覧には出さない（作問メモ・重複回避用） |

誤答タイプ（A〜M）は選択肢ごとに持つ。ユーザー回答の記録・集計はしない。

### 流れ

0. **分布を見る**: `pnpm juken:drills-stats` を実行し、リポジトリ全体のタグ出現回数と、題材・文体の一覧を読む。レポート末尾の「足りていないタグ」を、今回の割り当てで優先する
1. **割り当てる**: 問題数・配分・各問の入力（genre / mode / level / question_type / answer_position / theme / style）を決める。集計で少ないタグを増やし、既存の `theme`・`style` と重ならない題材と文体にする。正解位置と `question_type` が連続しないようにする
2. **作る**: 1 問ずつ `author-prompt.md` に従って JSON を書き、`qNN.json` に保存する。`excerpt` は青空文庫のファイルを取得して本文を取る
3. **形式を確かめる**: `pnpm juken:check-drills`。エラーは直す。警告も直せるなら直す
4. **別コンテキストで解かせる**: 問題ごとにサブエージェントを起動し、`passage`・`question`・`choices` だけを渡して `verify-prompt.md` のプロンプトで解かせる。答えと解説は渡さない。同じコンテキストで自分の問題を解き直して検証にしない
5. **採否を決める**: `verify-prompt.md` の基準で採否を決める。不採用は直すか、作り直す
6. **ひとやすみを書く**: 採用した問題が決まってから、`intro.mdoc` と `after-qNN.mdoc` を `references/interlude.md` に従って書く。登場キャラクターは `juken:drills-stats` の「ぬいぐるみ」で少ない子を優先し、同じ子だけが続かないようにする
7. **セットを見直す**: 配分、正解位置、題材の重なりを見る。`level 3` と気持ちの問題は、人が確認しやすいように提示で名指しする
8. **サイトで確かめる**: `pnpm web:dev` で `/juken/kokugo-choice/<セットID>` を開き、選択、✕、答え合わせ、「本文で見る」、ひとやすみの表示が動くことを確かめる

サブエージェントを起動できない環境では、検証を実行できなかったと提示で書く。その問題を採用済みとして扱わない。

### リポジトリに残す場合

ユーザーが求めたとき、またはクラウドで PR まで進める運用のときは、ブランチを切ってコミットし、PR を出す。コミットと PR タイトルは Conventional Commits にする（例: `feat(juken): add kokugo choice drill set 2026-11-22-01`）。

## 成果物

- `chugaku-juken/kokugo-choice/sets/<セットID>/q01.json …` と `intro.mdoc` / `after-qNN.mdoc`
- 公開 URL `/juken/kokugo-choice/<セットID>`
- 提示: パス、URL、問題ごとの属性表、不採用にした問題と理由
