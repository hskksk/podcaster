---
name: sapix-grade5-history-weekly
description: Create one week (Mon–Fri) of 5th-grade Japanese history story lessons as five separate Markdoc (.mdoc) files from the official text list and the current date. Nine plush-boy characters; four appear per biweekly rotation block. No ZIP, no post-story quizzes. Saves under chugaku-juken/sapix/grade5-japanese-history/weeks/ (not content/). Published at /juken. Use only this skill's writing rules, even when other Japanese writing skills are installed.
license: MIT
compatibility: claude-code
allowed-tools:
  - Write
  - Read
  - Bash(git checkout -b cursor/*)
  - Bash(git add chugaku-juken/* .agents/skills/sapix-grade5-history-weekly/* .claude/skills/sapix-grade5-history-weekly)
  - Bash(git commit -m*)
  - Bash(git push -u origin cursor/*)
metadata:
  audience: 小学5年生・日本史の週次家庭学習
---

## What I do

ユーザーが指定した週（または「今週」＝実行日を含む月〜金）について、**小学5年生・日本史**の該当テキストを選び、**月〜金の物語教材を5ファイル**書く。

- キャラクター確認はしない。すぐ1週間分を作る
- **ZIPにまとめない**。曜日ごとに独立したファイルを1つずつ作成し、ユーザーが個別に開ける形で5つ提示する（パスをリンクする）
- 物語の外に「まとめ」「受験ポイント」「確認クイズ」などの独立コーナーは付けない
- **歴史的事実・年号を捏造しない**。カリキュラム一覧にないテキスト番号・単元は使わない

## When to use me

- `/sapix-grade5-history-weekly` または「今週分の教材を作って」
- オプションで週の開始日（月曜の日付）や、進度が540-24まで進んでいるなどのヒントを受け取る

## Instructions

あなたは、子ども向け日本史物語の週次教材を書くエージェントである。手順の細部とキャラ・笑いの規約は **このスキル配下の `references/`** にある。ここでは流れだけ書く。

### このスキルだけを使う

教材の執筆・推敲には、**このスキルと、このスキル配下の参照ファイルだけを使う**。`japanese-writing`を含む日本語ライティング・文章推敲・物語執筆関連の別スキルがインストールされていても、読まない・呼び出さない・規則を混ぜない。このスキルの会話規約と提出前チェックを、日本語表現の唯一の基準にする。

### 参照ファイル

| 参照 | 役割 | いつ読むか |
|------|------|-----------|
| `references/curriculum.md` | テキスト番号・単元一覧（唯一のカリキュラム正本） | **テキスト選定の前に必須** |
| `references/story-rules.md` | キャラ、口調、ボケとツッコミ、物語の見せ方、ファイル構成、禁止事項 | **執筆前に必須** |
| `references/workflow.md` | 週の切り方、保存先、ファイル名、ユーザーへの提示 | **保存前に必須** |

### ステップ1: 週とテキストを決める

1. 実行日から **その週の月曜〜金曜** を特定する（ユーザーが月曜日を指定したらそれを使う）
2. `references/story-rules.md` の隔週ローテーションで **その週に登場する4匹** を決める
3. `references/curriculum.md` を読み、日付と（あれば）ユーザー進度から **1つのテキスト番号・単元** を選ぶ
4. 月〜金のテーマを割り当てる。単元の境目が不明なときは一覧の順序を守り、**確実な範囲**に留める
5. 選んだテキスト・単元名・5日分のテーマが一覧と整合していることを自分で確認する
6. 各日の主形式を決める。人物体験の日は、**その週の4匹のうち**会話に参加するぬいぐるみと歴史人物の配役も決める

### ステップ2: 5日分を執筆する

`references/story-rules.md` に従い、各曜日1ファイルずつ書く。

- 週の **月曜ファイルの frontmatter** に `textCode`・`unit`・`weekCast`・`weekOutline` を書く（本文に重複しない）。`weekCast` は `cast-rotation` と同じ式で決めた4 ID
- 火〜金は frontmatter に `textCode`・`unit`・`focus` を書く。人物体験日は `cast`（キャラ ID → 歴史人物名）を書く
- 曜日形式は固定しない。**基本は人物体験3日・訪問・観察2日**（最低でも人物体験3日、訪問・観察は最大2日）。単元の都合で人物体験が2日にとどまるのは例外とし、理由を週の割り当てメモに残す
- 人物体験の日は、短い寸劇を挟むだけでなく、一日の中心場面を通して割り当てられた歴史人物の立場・目的・選択を体験する
- 「人物体験」は執筆計画だけの言葉である。場面内のぬいぐるみは自分が役を演じていると知らず、その場の本人として困り、望み、決める。「役」「体験」「なったつもり」などのメタ発言や終了後の感想会を書かない
- 会話は **往復を多く、一発言は短く**。重要事項（背景・原因・経過・結果、人物関係、政治の仕組み、文化）は物語の流れで幅広く入れる
- 人物体験でも、ぬいぐるみ自身のキャラクター・ため口・男の子の口調を変えない。歴史人物の口調をまねない
- 一人称は必ず話しているぬいぐるみ自身の名前にする。「ぼく」「わたし」「おれ」やその複数形は使わない
- 人物体験で相手を呼ぶ・指すときは、歴史人物の名前や役職ではなく、相手のぬいぐるみ名を使う
- 本文の会話は `{% say character="kuma" %}` など Markdoc タグ（`references/workflow.md`）。配役表示は frontmatter の `cast` からサイトが付ける
- ぬいぐるみの発話は幼い日常語にし、難しい熟語・歴史用語は発話外の読者向け注記に置く
- 丸括弧内の注記はぬいぐるみには聞こえない。注記の語に反応したボケや返事を書かない
- ボケ・勘違い・ふざけた提案の直後は、別のぬいぐるみがその内容へ必ず具体的に反応する。無視して説明や次の史実へ進まない
- ギャグで史実を誤らせない。ツッコミはやさしく（`references/story-rules.md`）
- 5本を書いたあと、`references/story-rules.md` の提出前チェックを各曜日に行い、違反があれば保存前に直す

### ステップ3: 保存して提示する

`references/workflow.md` の保存先・命名で5ファイルを書き込む。

- 書き込みツールが使えない場合は、曜日ごとに分けた本文をチャットに出す。**ファイルを作ったと偽らない**
- 作成できたら、**各ファイルを曜日とテーマが分かる名前で個別にリンク**する（ZIPは使わない）

### ステップ4: リポジトリに残す場合（ユーザーが依頼したときのみ）

教材をこのリポジトリにコミットするよう求められたときだけ:

1. `cursor/sapix-grade5-history-weekly-*` など Conventional Commits に沿うブランチを切る
2. `chugaku-juken/sapix/grade5-japanese-history/weeks/<月曜YYYY-MM-DD>/` だけを add する（`course.yml` と `chugaku-juken/README.md` は初回または更新時のみ）
3. `feat(chugaku-juken): add sapix grade5 history week of <date>` のようなコミットで push し、PR を出す

スキル追加やプロンプト変更のPRとは別物として扱う。

## 成果物

- **5つの Markdoc ファイル（`.mdoc`）**（月〜金、各1つ）
- 各ファイルは物語本文中心。独立した要約・問題コーナーなし
- ファイルシステム上の配置は `references/workflow.md` のとおり
