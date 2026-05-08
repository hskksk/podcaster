import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { ThinkingLevel } from "npm:@google/genai";
import { createSupabaseClient } from "./db.ts";
import { loadConfig } from "./config.ts";
import { writeLog } from "./logger.ts";
import { queueSend } from "./queue.ts";
import { generateAudioWithGemini, generateScriptWithGemini } from "./gemini-provider.ts";
import {
  DEFAULT_SYSTEM_INSTRUCTION,
  DEFAULT_USER_PROMPT_TEMPLATE,
  generateScriptFromArticle,
} from "../../../shared/script-generation.ts";

type EpisodeForRss = {
  id: string;
  title: string;
  description: string;
  mem_note_id: string | null;
  created_at: string;
  published_at: string | null;
  audio_files: Array<{ storage_path: string; mime_type: string }>;
  articles: { title: string } | null;
};

function extractTokenUsage(usageMetadata: unknown): Record<string, number | null> {
  const usage = (usageMetadata ?? {}) as Record<string, unknown>;
  const readNumber = (key: string): number | null => {
    const v = usage[key];
    return typeof v === "number" ? v : null;
  };

  return {
    prompt_tokens: readNumber("promptTokenCount") ?? readNumber("inputTokenCount"),
    completion_tokens: readNumber("candidatesTokenCount") ?? readNumber("outputTokenCount"),
    total_tokens: readNumber("totalTokenCount"),
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeSelectionMode(value: unknown): "fixed" | "random" {
  return value === "random" ? "random" : "fixed";
}

function resolveSelectedValue(
  mode: "fixed" | "random",
  options: string[],
  fixedValue: string,
): string {
  const normalizedFixed = fixedValue.trim();
  if (mode === "fixed") {
    return normalizedFixed || options[0] || "";
  }
  if (options.length === 0) {
    return normalizedFixed;
  }
  const index = Math.floor(Math.random() * options.length);
  return options[index];
}

function buildToneInstructions(
  hostName: string,
  hostTone: string,
  cohostName: string,
  cohostTone: string,
): string {
  return [
    "話し方の追加指定:",
    `- ${hostName}: ${hostTone}`,
    `- ${cohostName}: ${cohostTone}`,
  ].join("\n");
}

function pcmToWav(
  pcm: Uint8Array,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): Uint8Array {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toRfc2822(iso: string): string {
  return new Date(iso).toUTCString();
}

function buildRssFeed(
  episodes: EpisodeForRss[],
  cfg: Record<string, string>,
  storageUrl: string,
): string {
  const title = escapeXml(cfg["podcast.title"] || "My AI Podcast");
  const description = escapeXml(cfg["podcast.description"] || "");
  const coverUrl = escapeXml(cfg["podcast.cover_url"] || `${storageUrl}/cover.png`);
  const feedUrl = `${storageUrl}/feed.xml`;

  const items = episodes
    .filter((ep) => ep.audio_files?.some((af) => af.storage_path))
    .map((ep) => {
      const af = ep.audio_files.find((a) => a.storage_path)!;
      const audioUrl = `${storageUrl}/${af.storage_path}`;
      const articleTitle = ep.articles?.title ?? "";
      return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description)}</description>
      <pubDate>${toRfc2822(ep.published_at || ep.created_at)}</pubDate>
      <enclosure url="${escapeXml(audioUrl)}" length="0" type="${af.mime_type}" />
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <podcaster:articleTitle><![CDATA[${articleTitle}]]></podcaster:articleTitle>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:podcaster="https://github.com/hskksk/podcaster">
  <channel>
    <title>${title}</title>
    <link>${feedUrl}</link>
    <description>${description}</description>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <image>
      <url>${coverUrl}</url>
      <title>${title}</title>
      <link>${feedUrl}</link>
    </image>
    <itunes:image href="${coverUrl}" />
${items}
  </channel>
</rss>`;
}

async function resolveEpisodeId(
  db: SupabaseClient,
  episodeId: string | null,
  legacyArticleId: string | null,
): Promise<string> {
  if (episodeId) return episodeId;
  if (!legacyArticleId) {
    throw new Error("episode_id is required for script stage");
  }

  const { data: existingEpisode } = await db
    .from("episodes")
    .select("id")
    .eq("article_id", legacyArticleId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingEpisode) return existingEpisode.id;

  const { data: articleForLegacy, error: legacyFetchErr } = await db
    .from("articles")
    .select("id, title, mem_note_id")
    .eq("id", legacyArticleId)
    .maybeSingle();
  if (legacyFetchErr || !articleForLegacy) {
    throw new Error(`Article not found for legacy payload: ${legacyArticleId}`);
  }
  const { data: createdEpisode, error: createEpisodeErr } = await db
    .from("episodes")
    .insert({
      article_id: articleForLegacy.id,
      mem_note_id: articleForLegacy.mem_note_id ?? null,
      title: (articleForLegacy.title || "Untitled").slice(0, 20),
      description: "",
      status: "ingested",
    })
    .select("id")
    .single();
  if (createEpisodeErr || !createdEpisode) {
    throw new Error(`Failed to create episode for legacy payload: ${createEpisodeErr?.message}`);
  }
  return createdEpisode.id;
}

export async function runGenerateScriptStage(opts: {
  episodeId: string | null;
  legacyArticleId?: string | null;
  regenerate?: boolean;
}): Promise<{ episodeId: string }> {
  const db = createSupabaseClient();
  const startMs = Date.now();
  const regenerate = opts.regenerate === true;
  let memNoteId: string | null = null;
  let episodeIdForLog: string | null = null;
  let articleIdForLog: string | null = opts.legacyArticleId ?? null;

  try {
    const episodeId = await resolveEpisodeId(db, opts.episodeId, opts.legacyArticleId ?? null);
    const { data: episode, error: episodeErr } = await db
      .from("episodes")
      .select("id, article_id, mem_note_id")
      .eq("id", episodeId)
      .maybeSingle();
    if (episodeErr || !episode) throw new Error(`Episode not found: ${episodeId}`);
    if (!episode.article_id) throw new Error(`Episode ${episodeId} has no article_id`);
    episodeIdForLog = episode.id;
    articleIdForLog = episode.article_id;

    const { data: article, error: fetchErr } = await db
      .from("articles")
      .select("content, mem_note_id")
      .eq("id", episode.article_id)
      .single();
    if (fetchErr || !article) throw new Error(`Article not found: ${episode.article_id}`);
    memNoteId = episode.mem_note_id ?? article.mem_note_id ?? null;

    const { error: runningErr } = await db
      .from("episodes")
      .update({ status: "script_running" })
      .eq("id", episode.id);
    if (runningErr) throw new Error(`Failed to set script_running: ${runningErr.message}`);

    const cfg = await loadConfig();
    const systemInstruction = cfg["generator.system_instruction"] as string || DEFAULT_SYSTEM_INSTRUCTION;
    const promptTemplate = cfg["generator.prompt_template"] as string || DEFAULT_USER_PROMPT_TEMPLATE;

    const generated = await generateScriptFromArticle({
      articleContent: article.content,
      model: cfg["generator.model"] || "gemini-2.5-flash",
      systemInstruction,
      promptTemplate,
      thinkingLevel: ThinkingLevel.HIGH,
      generateContent: (params) => generateScriptWithGemini(params),
    });

    const { error: updateErr } = await db
      .from("episodes")
      .update({
        mem_note_id: memNoteId,
        title: generated.title.slice(0, 20),
        description: generated.description.slice(0, 100),
        status: "script_ready",
      })
      .eq("id", episode.id);
    if (updateErr) throw new Error(`Episode update failed: ${updateErr.message}`);

    await db.from("scripts").insert({
      episode_id: episode.id,
      content: generated.script,
      status: "ready",
      llm_usage: generated.tokenUsage,
      llm_response: generated.responseJson,
    });

    await writeLog(db, {
      queue_name: null,
      message_id: null,
      article_id: episode.article_id,
      episode_id: episode.id,
      mem_note_id: memNoteId,
      status: "success",
      duration_ms: Date.now() - startMs,
    });
    return { episodeId: episode.id };
  } catch (err) {
    if (episodeIdForLog) {
      await db.from("episodes").update({ status: "script_failed" }).eq("id", episodeIdForLog);
      await db.from("scripts").insert({
        episode_id: episodeIdForLog,
        content: "",
        status: "failed",
        error: String(err),
        llm_usage: {},
        llm_response: { error: String(err), regenerate },
      });
    }
    await writeLog(db, {
      queue_name: null,
      message_id: null,
      ...(articleIdForLog ? { article_id: articleIdForLog } : {}),
      ...(episodeIdForLog ? { episode_id: episodeIdForLog } : {}),
      mem_note_id: memNoteId,
      status: "failure",
      error_message: String(err),
      duration_ms: Date.now() - startMs,
    });
    throw err;
  }
}

export async function runGenerateAudioStage(opts: {
  episodeId: string;
  regenerate?: boolean;
}): Promise<{ episodeId: string }> {
  const db = createSupabaseClient();
  const episodeId = opts.episodeId;
  const startMs = Date.now();
  console.log(`[audio] stage start episode_id=${episodeId}`);
  let memNoteId: string | null = null;
  let script: { id: string; content: string } | null = null;
  let ttsSelection: Record<string, unknown> | null = null;

  try {
    const { error: runningErr } = await db.from("episodes").update({ status: "audio_running" }).eq("id", episodeId);
    if (runningErr) throw new Error(`Failed to set audio_running: ${runningErr.message}`);

    const { data: scriptRow, error: scriptErr } = await db
      .from("scripts")
      .select("id, content, episodes(mem_note_id)")
      .eq("episode_id", episodeId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (scriptErr || !scriptRow) throw new Error(`Script not found for episode: ${episodeId}`);
    script = { id: scriptRow.id, content: scriptRow.content };
    memNoteId = (scriptRow.episodes as { mem_note_id?: string } | null)?.mem_note_id ?? null;

    const cfg = await loadConfig();
    const ttsModel = cfg["tts.model"] || "gemini-2.5-flash-preview-tts";
    const selectionMode = normalizeSelectionMode(cfg["tts.selection_mode"]);
    const hostName = cfg["tts.host.name"] || "Host";
    const cohostName = cfg["tts.cohost.name"] || "CoHost";
    const hostVoiceOptions = normalizeStringArray(cfg["tts.host.voice_options"]);
    const cohostVoiceOptions = normalizeStringArray(cfg["tts.cohost.voice_options"]);
    const hostToneOptions = normalizeStringArray(cfg["tts.host.tone_options"]);
    const cohostToneOptions = normalizeStringArray(cfg["tts.cohost.tone_options"]);

    const hostVoice = resolveSelectedValue(selectionMode, hostVoiceOptions, cfg["tts.host.voice"] || "Charon");
    const cohostVoice = resolveSelectedValue(selectionMode, cohostVoiceOptions, cfg["tts.cohost.voice"] || "Achird");
    const hostTone = resolveSelectedValue(
      selectionMode,
      hostToneOptions,
      cfg["tts.host.tone"] || "落ち着いて信頼感のある進行",
    );
    const cohostTone = resolveSelectedValue(
      selectionMode,
      cohostToneOptions,
      cfg["tts.cohost.tone"] || "親しみやすく好奇心のある受け答え",
    );
    const instructions = cfg["tts.instructions"];
    const toneInstructions = buildToneInstructions(hostName, hostTone, cohostName, cohostTone);
    const mergedInstructions = [instructions, toneInstructions]
      .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
      .join("\n\n");
    ttsSelection = {
      mode: selectionMode,
      host: { name: hostName, voice: hostVoice, tone: hostTone },
      cohost: { name: cohostName, voice: cohostVoice, tone: cohostTone },
    };

    const scriptWithInstructions = mergedInstructions
      ? `${mergedInstructions}\n\n${script.content}`
      : script.content;

    console.log(`[audio] calling Gemini TTS episode_id=${episodeId}`);
    const response = await generateAudioWithGemini({
      model: ttsModel,
      contents: [{ role: "user", parts: [{ text: scriptWithInstructions }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              { speaker: hostName, voiceConfig: { prebuiltVoiceConfig: { voiceName: hostVoice } } },
              { speaker: cohostName, voiceConfig: { prebuiltVoiceConfig: { voiceName: cohostVoice } } },
            ],
          },
        },
      },
    });
    console.log(`[audio] Gemini TTS returned episode_id=${episodeId}`);

    const usageMetadata = (response as { usageMetadata?: unknown }).usageMetadata ?? null;
    const tokenUsage = extractTokenUsage(usageMetadata);

    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    if (!audioPart?.inlineData?.data) {
      throw new Error("No audio data in Gemini TTS response");
    }

    const rawMime = audioPart.inlineData.mimeType || "audio/wav";
    const pcmBytes = Uint8Array.from(atob(audioPart.inlineData.data), (c) => c.charCodeAt(0));

    let audioBytes: Uint8Array;
    let uploadMime: string;
    if (rawMime.includes("L16") || rawMime.includes("pcm") || rawMime.includes("raw")) {
      const sampleRateMatch = rawMime.match(/rate=(\d+)/);
      const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1]) : 24000;
      audioBytes = pcmToWav(pcmBytes, sampleRate, 1, 16);
      uploadMime = "audio/wav";
    } else {
      audioBytes = pcmBytes;
      uploadMime = rawMime.includes("mp4") ? "audio/mp4"
        : rawMime.includes("mpeg") ? "audio/mpeg"
        : "audio/wav";
    }

    const ext = uploadMime === "audio/mp4" ? "m4a"
      : uploadMime === "audio/mpeg" ? "mp3"
      : "wav";
    const audioPath = `audio/${episodeId}.${ext}`;

    const audioBlob = new Blob([audioBytes], { type: uploadMime });
    const { error: uploadErr } = await db.storage
      .from("podcast")
      .upload(audioPath, audioBlob, {
        contentType: uploadMime,
        upsert: true,
        cacheControl: "31536000",
      });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);
    console.log(`[audio] upload completed episode_id=${episodeId} path=${audioPath}`);

    await db.from("audio_files").insert({
      episode_id: episodeId,
      script_id: script.id,
      storage_path: audioPath,
      mime_type: uploadMime,
      status: "ready",
      llm_usage: tokenUsage,
      llm_response: {
        usage_metadata: usageMetadata,
        tts_selection: ttsSelection,
        audio_mime_type: rawMime,
      },
    });
    await db.from("episodes").update({ status: "audio_ready" }).eq("id", episodeId);

    await writeLog(db, {
      queue_name: null,
      message_id: null,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "success",
      duration_ms: Date.now() - startMs,
    });
    console.log(`[audio] stage success episode_id=${episodeId}`);
    return { episodeId };
  } catch (err) {
    console.error(`[audio] stage failure episode_id=${episodeId}`, err);
    await db.from("audio_files").insert({
      episode_id: episodeId,
      script_id: script?.id ?? null,
      storage_path: "",
      mime_type: "",
      status: "failed",
      error: String(err),
      llm_usage: {},
      llm_response: { error: String(err), tts_selection: ttsSelection },
    });
    await db.from("episodes").update({ status: "audio_failed" }).eq("id", episodeId);
    await writeLog(db, {
      queue_name: null,
      message_id: null,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "failure",
      error_message: String(err),
      duration_ms: Date.now() - startMs,
    });
    throw err;
  }
}

export async function runUpdateRssStage(opts: {
  episodeId: string;
}): Promise<{ episodeId: string }> {
  const db = createSupabaseClient();
  const episodeId = opts.episodeId;
  const startMs = Date.now();
  let memNoteId: string | null = null;

  try {
    const cfg = await loadConfig();
    const { data: episodes, error: fetchErr } = await db
      .from("episodes")
      .select("id, title, description, mem_note_id, created_at, published_at, audio_files(storage_path, mime_type), articles(title)")
      .in("status", ["audio_ready", "published", "rss_failed"])
      .order("created_at", { ascending: false });
    if (fetchErr) throw new Error(`Episodes fetch failed: ${fetchErr.message}`);

    const currentEp = (episodes as EpisodeForRss[]).find((ep) => ep.id === episodeId);
    memNoteId = currentEp?.mem_note_id ?? null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const storageUrl = `${supabaseUrl}/storage/v1/object/public/podcast`;
    const xml = buildRssFeed(episodes as EpisodeForRss[], cfg, storageUrl);

    const encoder = new TextEncoder();
    const xmlBytes = encoder.encode(xml);
    const { error: uploadErr } = await db.storage
      .from("podcast")
      .upload("feed.xml", xmlBytes, {
        contentType: "text/xml",
        upsert: true,
        cacheControl: "60",
      });
    if (uploadErr) throw new Error(`feed.xml upload failed: ${uploadErr.message}`);

    await db
      .from("episodes")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", episodeId)
      .in("status", ["audio_ready", "rss_failed"]);

    await writeLog(db, {
      queue_name: null,
      message_id: null,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "success",
      duration_ms: Date.now() - startMs,
    });
    return { episodeId };
  } catch (err) {
    await db
      .from("episodes")
      .update({ status: "rss_failed" })
      .eq("id", episodeId)
      .in("status", ["audio_ready", "rss_failed"]);
    await writeLog(db, {
      queue_name: null,
      message_id: null,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "failure",
      error_message: String(err),
      duration_ms: Date.now() - startMs,
    });
    throw err;
  }
}
