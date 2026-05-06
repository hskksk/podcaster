#!/usr/bin/env tsx
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import {
  detectLocalStatus,
  detectProjectRef,
  detectServiceKey,
} from "./lib/supabase-detect.ts";

const target = process.env.TARGET ?? "remote";

let supabaseUrl: string;
let serviceKey: string;

if (target === "local") {
  const local = detectLocalStatus();
  supabaseUrl = local.apiUrl;
  serviceKey = local.serviceKey;
} else {
  const projectRef = detectProjectRef();
  serviceKey = detectServiceKey(projectRef);
  supabaseUrl = `https://${projectRef}.supabase.co`;
}

const publicUrl = process.env.PODCAST_PUBLIC_URL ?? supabaseUrl;
const supabase = createClient(supabaseUrl, serviceKey);

// Load config.toml
const configPath = resolve("config.toml");
if (!existsSync(configPath)) {
  console.error("config.toml not found.");
  process.exit(1);
}
const config = parseToml(readFileSync(configPath, "utf8")) as {
  podcast: { title: string; description: string; cover_image?: string };
  tts: {
    model: string;
    instructions: string;
    selection_mode?: "fixed" | "random";
    speakers: {
      host: {
        name: string;
        voice_name: string;
        tone?: string;
        voice_options?: string[];
        tone_options?: string[];
      };
      cohost: {
        name: string;
        voice_name: string;
        tone?: string;
        voice_options?: string[];
        tone_options?: string[];
      };
    };
  };
  generator: {
    model: string;
    system_instruction?: string;
    prompt_template?: string;
  };
};

// Upload cover image to Storage
const coverImage = config.podcast.cover_image ?? "cover.png";
const coverPath = resolve("public", coverImage);
if (existsSync(coverPath)) {
  const coverBytes = readFileSync(coverPath);
  const { error: uploadErr } = await supabase.storage
    .from("podcast")
    .upload(coverImage, coverBytes, { contentType: "image/png", upsert: true });
  if (uploadErr) {
    console.error("Failed to upload cover image:", uploadErr.message);
  } else {
    console.log(`Uploaded: public/${coverImage} → storage/podcast/${coverImage}`);
  }
} else {
  console.warn(`public/${coverImage} not found, skipping cover upload.`);
}

const coverUrl = `${publicUrl}/storage/v1/object/public/podcast/${coverImage}`;

const defaults: Record<string, unknown> = {
  "podcast.title": config.podcast.title,
  "podcast.description": config.podcast.description,
  "podcast.cover_url": coverUrl,
  "tts.model": config.tts.model,
  "tts.instructions": config.tts.instructions,
  "tts.selection_mode": config.tts.selection_mode ?? "fixed",
  "tts.host.name": config.tts.speakers.host.name,
  "tts.host.voice": config.tts.speakers.host.voice_name,
  "tts.host.tone": config.tts.speakers.host.tone ?? "落ち着いて信頼感のある進行",
  "tts.host.voice_options": config.tts.speakers.host.voice_options ?? [config.tts.speakers.host.voice_name],
  "tts.host.tone_options": config.tts.speakers.host.tone_options ?? [
    config.tts.speakers.host.tone ?? "落ち着いて信頼感のある進行",
  ],
  "tts.cohost.name": config.tts.speakers.cohost.name,
  "tts.cohost.voice": config.tts.speakers.cohost.voice_name,
  "tts.cohost.tone": config.tts.speakers.cohost.tone ?? "親しみやすく好奇心のある受け答え",
  "tts.cohost.voice_options": config.tts.speakers.cohost.voice_options ?? [
    config.tts.speakers.cohost.voice_name,
  ],
  "tts.cohost.tone_options": config.tts.speakers.cohost.tone_options ?? [
    config.tts.speakers.cohost.tone ?? "親しみやすく好奇心のある受け答え",
  ],
  "generator.model": config.generator.model,
};

if (config.generator.system_instruction) {
  defaults["generator.system_instruction"] = config.generator.system_instruction;
}
if (config.generator.prompt_template) {
  defaults["generator.prompt_template"] = config.generator.prompt_template;
}

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
