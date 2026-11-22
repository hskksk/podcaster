# 中学受験向け教材

家庭学習用の物語と問題を置く場所です。公開サイトの `/juken`（ふしぎ旅）が、このツリーをそのまま読みます。

`content/docs/`（Wiki・Keystatic）や `content/web-clips/` とは別系統です。ポッドキャスト ingest の対象ではありません。

## レイアウト

| パス | 内容 |
|------|------|
| `<塾>/<コース>/course.yml` | コース名、学年、科目、紹介。サイトのコースページに出る |
| `<塾>/<コース>/weeks/<月曜YYYY-MM-DD>/` | その週の月〜金。ファイル名は `月曜_テーマ.md` のように曜日で始める |

例: `sapix/grade5-japanese-history/weeks/2026-10-19/月曜_藤原氏のひみつ.mdoc`

各レッスンは **YAML frontmatter**（テキスト番号・単元・配役など）と **Markdoc 本文**（`{% scene %}` / `{% say %}`）で書く。詳細は `sapix-grade5-history-weekly` スキルの `references/workflow.md`。

公開 URL はディレクトリに対応します。

- `/juken`
- `/juken/sapix/grade5-japanese-history`
- `/juken/sapix/grade5-japanese-history/2026-10-19`
- `/juken/sapix/grade5-japanese-history/2026-10-19/mon`

曜日のパスは `mon` `tue` `wed` `thu` `fri` です。テーマはファイル名と見出しから取ります。

他の塾・科目を足すときは、`sapix/` や `yotsuya/` の下にコースディレクトリを切り、`course.yml` と `weeks/` を置きます。

## 国語 選択肢問題

`kokugo-choice/` は、塾・コースの木とは別系統の問題集です。

| パス | 内容 |
|------|------|
| `kokugo-choice/sets/<YYYY-MM-DD>-<NN>/qNN.json` | 1 問 1 ファイル。本文・設問・選択肢・正解・選択肢ごとの誤り分析 |
| `kokugo-choice/sets/<YYYY-MM-DD>-<NN>/intro.mdoc`, `after-qNN.mdoc` | 問題のあいだの「ひとやすみ」。ぬいぐるみたちの会話（`scene` / `say`） |

公開 URL は `/juken/kokugo-choice`（セット一覧）と `/juken/kokugo-choice/<セットID>`（解答画面）です。作問と検証は `kokugo-choice-drill` スキル、作問前のタグ分布は `pnpm juken:drills-stats`、形式のチェックは `pnpm juken:check-drills` です。各問には `genre` / `level` / `question_type` / `mode` のタグがあり、解答画面の問見出しにチップとして出ます。
