#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// Use PODCAST_PUBLIC_URL for local dev where SUPABASE_URL is internal (http://kong:8000)
const publicUrl = process.env.PODCAST_PUBLIC_URL ?? supabaseUrl;

const supabase = createClient(supabaseUrl, serviceKey);

// Upload cover.png to Storage if it exists
const coverPath = resolve("public/cover.png");
if (existsSync(coverPath)) {
  const coverBytes = readFileSync(coverPath);
  const { error: uploadErr } = await supabase.storage
    .from("podcast")
    .upload("cover.png", coverBytes, { contentType: "image/png", upsert: true });
  if (uploadErr) {
    console.error("Failed to upload cover.png:", uploadErr.message);
  } else {
    console.log("Uploaded: public/cover.png → storage/podcast/cover.png");
  }
} else {
  console.warn("public/cover.png not found, skipping cover upload.");
}

const coverUrl = `${publicUrl}/storage/v1/object/public/podcast/cover.png`;

const defaults: Record<string, unknown> = {
  "podcast.title": "My AI Podcast",
  "podcast.description": "AI が生成するテック系ポッドキャスト",
  "podcast.cover_url": coverUrl,
  "tts.model": "gemini-2.5-flash-preview-tts",
  "tts.instructions":
    "これは2人のスピーカーによるポッドキャストの会話です。自然な会話のトーンで、スピーカーの切り替わりに適切な間を置いて話してください。Hostが議論をリードし、CoHostは質問をしながら興味深く反応します。",
  "tts.host.name": "Host",
  "tts.host.voice": "Charon",
  "tts.cohost.name": "CoHost",
  "tts.cohost.voice": "Achird",
  "generator.model": "gemini-2.5-flash",
};

for (const [key, value] of Object.entries(defaults)) {
  const { error } = await supabase
    .from("podcast_config")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) {
    console.error(`Failed to seed ${key}:`, error.message);
  } else {
    console.log(`Seeded: ${key} = ${JSON.stringify(value)}`);
  }
}

console.log("Config seeded.");
