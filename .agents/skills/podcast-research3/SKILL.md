---
name: podcast-research3
description: Same survey workflow as podcast-research; use japanese-writing for Japanese prose when installed. Save Markdoc to content/docs/ and create a PR (does not auto-ingest).
license: MIT
compatibility: claude-code
allowed-tools:
  - WebSearch
  - WebFetch
  - Write
  - Read
  - Bash(git checkout -b article/*)
  - Bash(git add content/docs/*)
  - Bash(git commit -m*)
  - Bash(git push -u origin article/*)
  - Bash(gh pr create*)
metadata:
  audience: podcast producers
  companion-of: podcast-research
  japanese-prose: japanese-writing
---

## What I do

`podcast-research` と同じ調査手順・サーベイ型章立て・保存先・PR フローです。日本語の作法は **`japanese-writing` スキル**に委ねます（本スキルに `japanese.md` は含めません）。

1. **多角的なリサーチ**: 概要・背景・詳細・最新動向・具体例・関連トピックを複数回のWeb検索で収集
2. **レポート保存**: `content/docs/` に Markdoc (`index.mdoc`) として保存する（公開 Wiki / 旧 `articles/` 相当）
3. **PR 作成**: origin/main ベースのブランチを作成して PR を出す（マージしても TTS は走らない。`podcast: none`）

**保存先の区別**: `content/web-clips/` は短い Web クリップ・クイックメモ用。本スキルのような **深い調査レポートは `content/docs/` に置く**（Keystatic の Wiki Documents）。

## When to use me

- `/podcast-research3 <テーマ>` の形式で呼び出す
- `/podcast-research` と同じサーベイ型。日本語レポートでは `japanese-writing` の併用を前提にしたエイリアス

## Instructions

**手順の正本は `podcast-research` の `SKILL.md` である。** 以下は差分だけ。

### 日本語の執筆

`podcast-research` の `references/japanese-writing-hook.md` と同じ。**`japanese-writing` スキル**を執筆前・推敲前に読み込む。

### ステップ 3〜4

章立て・分量・Markdoc・PR は `podcast-research` と同一。PR 本文のスキル名は `podcast-research3` と書いてよい。

### 注意事項

- `podcast-research` / `podcast-research2` を置き換えない
- `japanese-writing` は `npx skills add hskksk/agent-skills --skill japanese-writing` で導入（[skills.sh](https://skills.sh/hskksk/agent-skills/japanese-writing)）
