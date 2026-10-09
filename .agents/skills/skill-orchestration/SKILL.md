---
name: skill-orchestration
description: 複数のスキルを一つの仕事に組み合わせるとき、呼び出し側と、他から呼ばれる側の書き方を決める。境界はスキル名と相手の手順だけにし、他スキルのファイルは指さない。Use when writing or reviewing a skill that calls other skills, or a skill that other skills should be able to call.
license: MIT
metadata:
  author: hskksk
  version: 1.5.0
---


# スキルを組み合わせる

スキルを名前でつなぐときの境界を決める。呼び出し側を書くときと、他から呼ばれるスキルを書くときの両方で使う。両側は同じ境界の読み方なので、このスキルが正本である。別スキルには分けない。

他スキルを呼ばず、他からも呼ばれない文章だけを直すときは使わない。

今の作業がどちらかを決めてから、対応するファイルだけを読む。両方を一度に全部読まない。

| いつ | 読む |
| --- | --- |
| 呼び出し側を書く、直す、レビューする | `references/caller.md`。理由が要るときは `references/practices.md` |
| 他から呼ばれるスキルを書く、直す、レビューする | `references/callable-skill.md`。理由が要るときは `references/practices.md` |
| 呼び出し側と呼ばれる側の対応を見る | `references/caller.md` と `references/callable-skill.md` |

## 境界

他スキルとの間で書いてよいのは、次だけである。

- スキル名
- いつそのスキルを読むか
- 渡す成果物と、戻ったら次へ進む条件
- そのスキルの `SKILL.md` を読み、手順に従う、という一文

呼ばれる側は、この四つで仕事が終わる入口を `description` と `SKILL.md` に置く。呼び出し側は、この四つ以外を書かない。補助ファイル、スクリプト、節番号、テンプレート名は、そのスキルの外へ出さない。
