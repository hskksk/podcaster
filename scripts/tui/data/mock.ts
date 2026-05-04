// Mock data for TUI development, ported from the design prototype.
import crypto from 'node:crypto';

export const NOW = new Date('2026-04-28T10:00:00+09:00');

const minus = (mins: number) => new Date(NOW.getTime() - mins * 60000).toISOString();

export const ARTICLES = [
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    mem_note_id: 'mem_KX91nA8',
    title: '勝海舟 ── 幕末・明治を生き抜いた「最後の幕臣」',
    source: 'mem',
    word_count: 4820,
    created_at: minus(60 * 4),
    content: `# 勝海舟 ── 幕末・明治を生き抜いた「最後の幕臣」

## 概要

勝海舟（1823〜1899）は、幕末から明治にかけて日本の歴史を動かしたキーパーソンの一人である。`,
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    mem_note_id: 'mem_NQ34pB9',
    title: 'AIのメモリー機能：短期記憶・長期記憶・抽象化記憶をどう扱うか',
    source: 'mem',
    word_count: 7220,
    created_at: minus(60 * 26),
    content: `# AIのメモリー機能：短期記憶・長期記憶・抽象化記憶をどう扱うか

## 概要

大規模言語モデル（LLM）を基盤とするAIエージェントに「記憶」を持たせることは...`,
  },
  {
    id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    mem_note_id: 'mem_UN1TeX',
    title: 'UniTeX数式レンダリング検証ノート',
    source: 'mem',
    word_count: 980,
    created_at: minus(60 * 2),
    content: `# UniTeX 数式レンダリング検証

UniTeX README の example にある式を、そのまま Markdown 内に埋めた検証用データです。

## Text formula

- $\\TeX$
- $\\LaTeX$
- $\\KaTeX$
- $\\UniTeX$
- $a^2 + b^2 = c^2$
- $\\ell(D) - \\ell(K-D) = \\deg D - g + 1$
- $E[m] \\simeq \\Z/m\\Z \\times \\Z/m\\Z$

## Inline math

- $J = [\\frac{\\partial f_1}{\\partial x_1} \\cdots \\frac{\\partial f_n}{\\partial x_n}]$
- $\\mathbb{R}^n$
- $x_i = \\frac{a_i}{b_i}$

## Block math

$$\\dfrac{4}{\\pi}=1+\\dfrac{1^2}{2+\\dfrac{3^2}{2+\\dfrac{5^2}{2+\\ddots}}}$$

## Matrix sample

$$
\\begin{pmatrix}
\\cos\\theta & -\\sin\\theta \\\\
\\sin\\theta & \\cos\\theta
\\end{pmatrix}
$$`,
  },
];

export const EPISODES = [
  {
    id: 'ep1',
    article_id: ARTICLES[0].id,
    mem_note_id: ARTICLES[0].mem_note_id,
    title: '第48回：江戸を救った男 ─ 勝海舟と無血開城の交渉術',
    status: 'audio_ready',
    created_at: minus(60 * 4 - 18),
  },
  {
    id: 'ep2',
    article_id: ARTICLES[1].id,
    mem_note_id: ARTICLES[1].mem_note_id,
    title: '第47回：AIに「記憶」をもたせる ─ 短期・長期・抽象化のアーキテクチャ',
    status: 'published',
    created_at: minus(60 * 26 - 12),
  },
  {
    id: 'ep3',
    article_id: null,
    mem_note_id: 'mem_X1',
    title: '第49回：未着手の企画',
    status: 'script_ready',
    created_at: minus(10),
  }
];

export const SCRIPTS = [
  {
    id: 's1',
    episode_id: 'ep1',
    content: JSON.stringify([
      { speaker: 'Host', text: 'こんにちは、今日のテーマは「江戸を救った男」、勝海舟です。' },
      { speaker: 'CoHost', text: 'おお、海舟いきますか。' }
    ]),
    status: 'ready',
    created_at: minus(60 * 4 - 15),
  }
];

export const AUDIO_FILES = [
  {
    id: 'af1',
    episode_id: 'ep1',
    storage_path: 'audio/ep1.wav',
    mime_type: 'audio/wav',
    status: 'ready',
    created_at: minus(60 * 4 - 5),
  }
];

export const LOGS = [
  {
    processed_at: minus(2),
    queue_name: 'rss-queue',
    status: 'success',
    episode_id: 'ep1',
    article_id: null,
    duration_ms: 412,
    error_message: null,
  },
  {
    processed_at: minus(5),
    queue_name: 'audio-queue',
    status: 'failure',
    episode_id: 'ep3',
    article_id: null,
    duration_ms: 90000,
    error_message: 'Timeout error from TTS API',
  },
  {
    processed_at: minus(45),
    queue_name: 'script-queue',
    status: 'success',
    episode_id: null,
    article_id: ARTICLES[1].id,
    duration_ms: 2100,
    error_message: null,
  }
];

export const CONFIG = [
  { key: 'podcast.title', value: 'Podcaster Daily' },
  { key: 'podcast.description', value: 'AIが生成するテック・教養ポッドキャスト' },
  { key: 'tts.host.name', value: 'Host' },
  { key: 'tts.cohost.name', value: 'CoHost' },
];

export const INBOX = [
  { name: '20260428_NewTopic.md', size: 1234, mtime: minus(1) },
  { name: 'queue_mem_KX91nA8.md', size: 500, mtime: minus(3) },
];

export const DRAFT = [
  { name: '20260423_勝海舟.md', size: 11663, mtime: minus(60 * 72) },
];
