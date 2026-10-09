---
name: survey-report
description: 調査依頼を Phase 1（探索型）または Phase 2（検証・構造化型）に振り分け、前・中・後重心と読者レベルを選んでレポートを構成・出力する。地図と3つの問い、または結論と根拠の対応。Use when routing research requests and writing landscape or decision-oriented survey reports.
license: MIT
metadata:
  author: hskksk
  version: 1.1.0
---


# 調査レポート（Phase × 重心 × 読者レベル）

依頼に応じて Phase 1（探索型）または Phase 2（検証・構造化型）を選び、重心（前・中・後）と読者レベル（入門・実務・専門）を別々に決めてレポートを書く。三つは独立した軸である。詳細なルールの正本は `references/` に置き、このファイルでは作業順と参照先だけを案内する。

## いつ使うか

- リサーチ・調査の依頼を受け、レポート形式でまとめる
- テーマの全体像・論点整理（探索）か、比較・仮説検証・意思決定向けの結論提示（検証）かを決める

単なるリンク集・用語辞典だけの出力には使わない。

## 手順

1. **Phase を選ぶ。** `references/phase-routing.md` の判定フローに従う。
2. **重心と読者レベルを決める。** `references/gravity.md` と `references/reader-level.md` を読み、各軸を独立に選ぶ。選択理由の作業メモは本文に出さない。
3. **該当する Phase ガイドと共通ルールを読む。** Phase 1 は `references/phase-1-guide.md`、Phase 2 は `references/phase-2-guide.md` を使い、どちらも `references/report-conventions.md` に従う。
4. **提出前に確認する。** `references/checklists.md` の共通テストと該当する Phase・重心のテストを行う。必要に応じて `references/measure.py` で計測する。

## 参照ファイル

| ファイル | 内容 | いつ読むか |
| --- | --- | --- |
| `references/phase-routing.md` | Phase 1/2 の選び方 | 最初 |
| `references/gravity.md` | 前・中・後の重心の選び方と情報配置 | 執筆前 |
| `references/reader-level.md` | 入門・実務・専門の前提と説明の始め方 | 執筆前 |
| `references/phase-1-guide.md` | Phase 1 の成果物と構成案 | Phase 1 のとき |
| `references/phase-2-guide.md` | Phase 2 の答えと根拠の対応 | Phase 2 のとき |
| `references/report-conventions.md` | 全 Phase 共通の出力ルール | 構成・執筆時 |
| `references/checklists.md` | 共通・Phase 別・重心別の提出前テスト | 提出前 |
| `references/measure.py` | 数えられる共通指標の計測（TL;DR、`[n]`、出典、字数） | 提出前（任意） |

日本語で書くときは、リポジトリに `japanese-writing` スキルがあれば執筆前と推敲前に読み込み、その手順に従う。

## このスキルが扱わないこと

一次調査の実行手順（検索クエリ設計、API 呼び出し、インタビュー設計）や、特定組織の社内テンプレート・保存先・TTS/PR 手順は含めない。出力は Markdown レポートの構造と論旨の型に限定する。
