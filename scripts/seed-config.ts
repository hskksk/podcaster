#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const defaults: Record<string, unknown> = {
  "podcast.title": "My AI Podcast",
  "podcast.description": "AI が生成するテック系ポッドキャスト",
  "podcast.cover_url": `${process.env.SUPABASE_URL}/storage/v1/object/public/podcast/cover.png`,
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
