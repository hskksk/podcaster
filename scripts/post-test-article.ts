#!/usr/bin/env tsx
import crypto from "node:crypto";

const INGEST_URL =
  process.env.INGEST_URL ?? "http://127.0.0.1:54331/functions/v1/ingest";
const WEBHOOK_SECRET = process.env.INGEST_WEBHOOK_SECRET ?? "";

const article = {
  title: "テスト記事: AI生成ポッドキャストの仕組み",
  content: `
AI生成ポッドキャストとは、大規模言語モデル（LLM）とテキスト音声変換（TTS）技術を組み合わせて、
テキスト記事から自動的に音声形式のポッドキャストエピソードを生成するシステムのことです。

## 仕組み

1. **記事の取り込み**: ユーザーが記事テキストをシステムに送信します。
2. **台本生成**: LLM（例: Gemini, Claude）が記事をもとに、ホストとコ・ホストの対話形式の台本を作成します。
3. **音声合成**: TTSエンジン（例: Gemini TTS）が台本を読み上げ、複数話者の音声を生成します。
4. **配信**: 生成した音声ファイルをPodcast RSSフィードに追加し、各種Podcastアプリで聴けるようにします。

## 利点

- 記事を手軽に「聴ける」コンテンツに変換できる
- 複数話者による対話形式でわかりやすい解説が可能
- 全工程が自動化されているため、コンテンツ生産の効率が大幅に向上する

## 技術スタック

- **バックエンド**: Supabase Edge Functions (Deno/TypeScript)
- **データベース**: PostgreSQL + pgmq (メッセージキュー)
- **ストレージ**: Supabase Storage (グローバルCDN付き)
- **LLM**: Google Gemini 2.5 Flash
- **TTS**: Google Gemini 2.5 Flash TTS (多話者対応)
  `.trim(),
};

const body = JSON.stringify(article);

// Include service role key as Bearer token for local dev (supabase functions serve enforces JWT)
const authKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
};

if (WEBHOOK_SECRET) {
  const mac = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  headers["x-signature"] = `sha256=${mac}`;
}

console.log(`POST ${INGEST_URL}`);
const res = await fetch(INGEST_URL, { method: "POST", headers, body });
const json = await res.json();
console.log(`Status: ${res.status}`, json);
