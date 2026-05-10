import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { ThinkingLevel } from "npm:@google/genai";
import { createSupabaseClient } from "./db.ts";
import { loadConfig } from "./config.ts";
import { writeLog } from "./logger.ts";
import { generateScriptWithGemini } from "./gemini-provider.ts";
import {
  fetchBatchTtsAsWav,
  getBatchStatus,
  submitBatchTts,
  type GeminiBatchTtsClient,
} from "../../../packages/gemini-batch-tts/src/index.ts";
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
    const geminiApiEndpoint = resolveGeminiApiEndpoint(cfg["gemini.api_endpoint"]);

    const generated = await generateScriptFromArticle({
      articleContent: article.content,
      model: cfg["generator.model"] || "gemini-2.5-flash",
      systemInstruction,
      promptTemplate,
      thinkingLevel: ThinkingLevel.HIGH,
      generateContent: (params) => generateScriptWithGemini(params, { apiEndpoint: geminiApiEndpoint }),
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
      queue_name: "",
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
      queue_name: "",
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

const AUDIO_BATCH_PENDING_STATES = new Set([
  "JOB_STATE_QUEUED",
  "JOB_STATE_PENDING",
  "JOB_STATE_RUNNING",
  "JOB_STATE_CANCELLING",
  "JOB_STATE_UPDATING",
  "JOB_STATE_PAUSED",
]);

const AUDIO_BATCH_SUCCESS_STATES = new Set([
  "JOB_STATE_SUCCEEDED",
  "JOB_STATE_PARTIALLY_SUCCEEDED",
]);

const AUDIO_BATCH_FAILURE_STATES = new Set([
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
]);

const DEFAULT_GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com";
const DEFAULT_GEMINI_API_VERSION = "v1beta";

function resolveGeminiApiEndpoint(configValue: unknown): string {
  if (typeof configValue === "string" && configValue.trim().length > 0) {
    return configValue.trim();
  }
  return DEFAULT_GEMINI_API_ENDPOINT;
}

function normalizeBatchState(state: string): string {
  if (state.startsWith("BATCH_STATE_")) {
    return `JOB_STATE_${state.slice("BATCH_STATE_".length)}`;
  }
  return state;
}

function splitGeminiApiEndpoint(endpoint: string): {
  apiRoot: string;
  apiVersion: string;
} {
  const trimmed = endpoint.replace(/\/+$/, "");
  const match = trimmed.match(/\/(v1|v1beta)$/);
  if (match) {
    return {
      apiRoot: trimmed.slice(0, -match[0].length),
      apiVersion: match[1],
    };
  }
  return { apiRoot: trimmed, apiVersion: DEFAULT_GEMINI_API_VERSION };
}

function resolveGeminiApiKey(endpoint: string): string {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (apiKey && apiKey.length > 0) return apiKey;
  const { apiRoot } = splitGeminiApiEndpoint(endpoint);
  if (apiRoot !== DEFAULT_GEMINI_API_ENDPOINT) {
    return "mock-api-key";
  }
  throw new Error("GEMINI_API_KEY is required when using the default Gemini API endpoint");
}

function createGeminiBatchTtsClient(params: {
  apiEndpoint: string;
  model: string;
}): GeminiBatchTtsClient {
  const { apiRoot, apiVersion } = splitGeminiApiEndpoint(params.apiEndpoint);
  return {
    apiKey: resolveGeminiApiKey(params.apiEndpoint),
    apiRoot,
    apiVersion,
    model: params.model,
  };
}

function readBatchJobName(llmResponse: unknown): string | null {
  const response = (llmResponse ?? {}) as Record<string, unknown>;
  const batch = (response.batch ?? {}) as Record<string, unknown>;
  const jobName = batch.jobName;
  return typeof jobName === "string" && jobName.length > 0 ? jobName : null;
}

function readBatchApiEndpoint(llmResponse: unknown): string | null {
  const response = (llmResponse ?? {}) as Record<string, unknown>;
  const batch = (response.batch ?? {}) as Record<string, unknown>;
  const apiEndpoint = batch.apiEndpoint;
  return typeof apiEndpoint === "string" && apiEndpoint.trim().length > 0 ? apiEndpoint.trim() : null;
}

function readBatchPollCount(llmResponse: unknown): number {
  const response = (llmResponse ?? {}) as Record<string, unknown>;
  const batch = (response.batch ?? {}) as Record<string, unknown>;
  const pollCount = batch.pollCount;
  return typeof pollCount === "number" && Number.isFinite(pollCount) ? pollCount : 0;
}

export async function startGeneratingAudio(opts: {
  episodeId: string;
  regenerate?: boolean;
}): Promise<{ episodeId: string }> {
  const db = createSupabaseClient();
  const episodeId = opts.episodeId;
  const startMs = Date.now();
  console.log(`[audio-start] stage start episode_id=${episodeId}`);
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

    const { data: pendingAudio, error: pendingErr } = await db
      .from("audio_files")
      .select("id, llm_response")
      .eq("episode_id", episodeId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingErr) throw new Error(`Failed to find pending audio record: ${pendingErr.message}`);

    const existingJobName = readBatchJobName(pendingAudio?.llm_response ?? null);
    if (existingJobName && !opts.regenerate) {
      await writeLog(db, {
        queue_name: "",
        message_id: null,
        episode_id: episodeId,
        mem_note_id: memNoteId,
        status: "success",
        duration_ms: Date.now() - startMs,
      });
      return { episodeId };
    }

    const cfg = await loadConfig();
    const geminiApiEndpoint = resolveGeminiApiEndpoint(cfg["gemini.api_endpoint"]);
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

    const batchClient = createGeminiBatchTtsClient({
      apiEndpoint: geminiApiEndpoint,
      model: ttsModel,
    });
    console.log(`[audio-start] creating Gemini batch episode_id=${episodeId}`);
    const batchJob = await submitBatchTts(batchClient, {
      scriptText: scriptWithInstructions,
      host: { name: hostName, voice: hostVoice },
      cohost: { name: cohostName, voice: cohostVoice },
      displayName: `podcaster-audio-${episodeId}`,
      requestKey: script.id,
    });
    console.log(`[audio-start] Gemini batch created episode_id=${episodeId} job=${batchJob.batchName}`);

    const now = new Date().toISOString();
    const llmResponse = {
      batch: {
        jobName: batchJob.batchName,
        state: "JOB_STATE_RUNNING",
        apiEndpoint: geminiApiEndpoint,
        inputFile: batchJob.inputFile,
        createdAt: now,
        lastPolledAt: null,
        pollCount: 0,
      },
      tts_selection: ttsSelection,
      audio_mime_type: null,
    };

    if (pendingAudio) {
      const { error: updatePendingErr } = await db
        .from("audio_files")
        .update({
          script_id: script.id,
          storage_path: "",
          mime_type: "",
          status: "pending",
          error: null,
          llm_usage: {},
          llm_response: llmResponse,
        })
        .eq("id", pendingAudio.id);
      if (updatePendingErr) throw new Error(`Failed to update pending audio row: ${updatePendingErr.message}`);
    } else {
      const { error: insertPendingErr } = await db.from("audio_files").insert({
        episode_id: episodeId,
        script_id: script.id,
        storage_path: "",
        mime_type: "",
        status: "pending",
        llm_usage: {},
        llm_response: llmResponse,
      });
      if (insertPendingErr) throw new Error(`Failed to insert pending audio row: ${insertPendingErr.message}`);
    }

    await writeLog(db, {
      queue_name: "",
      message_id: null,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "success",
      duration_ms: Date.now() - startMs,
    });
    return { episodeId };
  } catch (err) {
    console.error(`[audio-start] stage failure episode_id=${episodeId}`, err);
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
      queue_name: "",
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

export async function pollGeneratingAudio(opts: {
  episodeId: string;
}): Promise<{ episodeId: string; done: boolean }> {
  const db = createSupabaseClient();
  const episodeId = opts.episodeId;
  const startMs = Date.now();
  console.log(`[audio-poll] stage start episode_id=${episodeId}`);
  let memNoteId: string | null = null;
  let ttsSelection: Record<string, unknown> | null = null;
  let pendingAudioId: string | null = null;
  let failureHandled = false;

  try {
    const { data: episode, error: episodeErr } = await db
      .from("episodes")
      .select("id, status, mem_note_id")
      .eq("id", episodeId)
      .maybeSingle();
    if (episodeErr || !episode) throw new Error(`Episode not found: ${episodeId}`);
    memNoteId = episode.mem_note_id ?? null;

    if (episode.status === "audio_ready" || episode.status === "published") {
      return { episodeId, done: true };
    }
    if (episode.status === "audio_failed") {
      failureHandled = true;
      throw new Error(`Audio already failed for episode: ${episodeId}`);
    }

    const cfg = await loadConfig();
    const defaultGeminiApiEndpoint = resolveGeminiApiEndpoint(cfg["gemini.api_endpoint"]);

    const { data: pendingAudio, error: pendingErr } = await db
      .from("audio_files")
      .select("id, script_id, llm_response")
      .eq("episode_id", episodeId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingErr) throw new Error(`Failed to load pending audio job: ${pendingErr.message}`);
    if (!pendingAudio) throw new Error(`Pending audio job not found for episode: ${episodeId}`);
    pendingAudioId = pendingAudio.id;

    const llmResponse = (pendingAudio.llm_response ?? {}) as Record<string, unknown>;
    ttsSelection = (llmResponse.tts_selection as Record<string, unknown> | null) ?? null;
    const batchInfo = (llmResponse.batch ?? {}) as Record<string, unknown>;
    const jobName = readBatchJobName(llmResponse);
    if (!jobName) throw new Error(`Batch job name is missing for episode: ${episodeId}`);

    const batchApiEndpoint = readBatchApiEndpoint(llmResponse) ?? defaultGeminiApiEndpoint;
    const batchClient = createGeminiBatchTtsClient({
      apiEndpoint: batchApiEndpoint,
      model: String(cfg["tts.model"] || "gemini-2.5-flash-preview-tts"),
    });
    const pollCount = readBatchPollCount(llmResponse);
    const polledStatus = await getBatchStatus(batchClient, jobName);
    const polledState = normalizeBatchState(polledStatus.state);
    const now = new Date().toISOString();
    const nextBatch = {
      ...batchInfo,
      jobName,
      state: polledState,
      rawState: polledStatus.state,
      apiEndpoint: batchApiEndpoint,
      outputFile: polledStatus.output ?? null,
      pollCount: pollCount + 1,
      lastPolledAt: now,
    };

    if (AUDIO_BATCH_PENDING_STATES.has(polledState)) {
      const { error: updatePendingErr } = await db
        .from("audio_files")
        .update({
          llm_response: {
            ...llmResponse,
            batch: nextBatch,
          },
        })
        .eq("id", pendingAudioId)
        .eq("status", "pending");
      if (updatePendingErr) throw new Error(`Failed to update pending batch state: ${updatePendingErr.message}`);
      return { episodeId, done: false };
    }

    if (AUDIO_BATCH_FAILURE_STATES.has(polledState)) {
      const failureMessage = String(polledStatus.error ?? `Gemini batch ended with ${polledState}`);
      const { error: failAudioErr } = await db
        .from("audio_files")
        .update({
          status: "failed",
          error: failureMessage,
          llm_usage: {},
          llm_response: {
            ...llmResponse,
            batch: nextBatch,
            error: polledStatus.error ?? null,
          },
        })
        .eq("id", pendingAudioId)
        .eq("status", "pending");
      if (failAudioErr) throw new Error(`Failed to mark audio failed: ${failAudioErr.message}`);

      await db.from("episodes").update({ status: "audio_failed" }).eq("id", episodeId);
      await writeLog(db, {
        queue_name: "",
        message_id: null,
        episode_id: episodeId,
        mem_note_id: memNoteId,
        status: "failure",
        error_message: failureMessage,
        duration_ms: Date.now() - startMs,
      });
      failureHandled = true;
      throw new Error(failureMessage);
    }

    if (!AUDIO_BATCH_SUCCESS_STATES.has(polledState)) {
      throw new Error(`Unexpected batch state for episode ${episodeId}: ${polledState}`);
    }
    console.log(
      `[audio-poll] batch succeeded episode_id=${episodeId} job=${jobName} state=${polledState} poll_count=${pollCount + 1}`,
    );
    const wavTempPath = `/tmp/podcaster-audio-${episodeId}-${crypto.randomUUID()}.wav`;
    console.log(`[audio-poll] fetching batch output to wav episode_id=${episodeId} tmp=${wavTempPath}`);
    const fetchedWav = await fetchBatchTtsAsWav(batchClient, {
      batchName: jobName,
      outPath: wavTempPath,
    });
    const wavStat = await Deno.stat(wavTempPath);
    const rawMime = fetchedWav.mimeType;
    const uploadMime = "audio/wav";
    const audioPath = `audio/${episodeId}.wav`;
    const tokenUsage = {
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
    };
    console.log(
      `[audio-poll] wav ready episode_id=${episodeId} raw_mime=${rawMime} pcm_bytes=${fetchedWav.pcmBytes} wav_bytes=${wavStat.size}`,
    );
    console.log(
      `[audio-poll] uploading wav episode_id=${episodeId} path=${audioPath} upload_mime=${uploadMime}`,
    );
    const wavFile = await Deno.open(wavTempPath, { read: true });
    try {
      const { error: uploadErr } = await db.storage
        .from("podcast")
        .upload(audioPath, wavFile.readable, {
          contentType: uploadMime,
          upsert: true,
          cacheControl: "31536000",
        });
      if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);
    } finally {
      try {
        wavFile.close();
      } catch (closeErr) {
        if (!(closeErr instanceof Deno.errors.BadResource)) {
          throw closeErr;
        }
        console.log(`[audio-poll] wav file already closed episode_id=${episodeId}`);
      }
      await Deno.remove(wavTempPath).catch(() => undefined);
    }
    console.log(`[audio-poll] upload completed episode_id=${episodeId} path=${audioPath} upload_mime=${uploadMime}`);

    console.log(
      `[audio-poll] updating audio_files row episode_id=${episodeId} pending_audio_id=${pendingAudioId}`,
    );
    const { error: updateAudioErr } = await db
      .from("audio_files")
      .update({
        script_id: pendingAudio.script_id ?? null,
        storage_path: audioPath,
        mime_type: uploadMime,
        status: "ready",
        error: null,
        llm_usage: tokenUsage,
        llm_response: {
          ...llmResponse,
          batch: {
            ...nextBatch,
            completedAt: new Date().toISOString(),
          },
          usage_metadata: null,
          tts_selection: ttsSelection,
          audio_mime_type: rawMime,
        },
      })
      .eq("id", pendingAudioId)
      .eq("status", "pending");
    if (updateAudioErr) throw new Error(`Failed to mark audio ready: ${updateAudioErr.message}`);
    console.log(
      `[audio-poll] audio_files row updated episode_id=${episodeId} pending_audio_id=${pendingAudioId}`,
    );

    await db.from("episodes").update({ status: "audio_ready" }).eq("id", episodeId);
    console.log(`[audio-poll] episode status updated to audio_ready episode_id=${episodeId}`);
    await writeLog(db, {
      queue_name: "",
      message_id: null,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "success",
      duration_ms: Date.now() - startMs,
    });
    return { episodeId, done: true };
  } catch (err) {
    console.error(`[audio-poll] stage failure episode_id=${episodeId}`, err);

    if (!failureHandled) {
      if (pendingAudioId) {
        await db
          .from("audio_files")
          .update({
            status: "failed",
            error: String(err),
            llm_usage: {},
            llm_response: {
              error: String(err),
              tts_selection: ttsSelection,
            },
          })
          .eq("id", pendingAudioId)
          .eq("status", "pending");
      } else {
        await db.from("audio_files").insert({
          episode_id: episodeId,
          script_id: null,
          storage_path: "",
          mime_type: "",
          status: "failed",
          error: String(err),
          llm_usage: {},
          llm_response: { error: String(err), tts_selection: ttsSelection },
        });
      }

      await db.from("episodes").update({ status: "audio_failed" }).eq("id", episodeId);
      await writeLog(db, {
        queue_name: "",
        message_id: null,
        episode_id: episodeId,
        mem_note_id: memNoteId,
        status: "failure",
        error_message: String(err),
        duration_ms: Date.now() - startMs,
      });
    }

    throw err;
  }
}

export async function runGenerateAudioStage(opts: {
  episodeId: string;
  regenerate?: boolean;
}): Promise<{ episodeId: string }> {
  await startGeneratingAudio(opts);
  const polled = await pollGeneratingAudio({ episodeId: opts.episodeId });
  if (!polled.done) {
    throw new Error(`Audio batch is still running for episode: ${opts.episodeId}`);
  }
  return { episodeId: opts.episodeId };
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
      queue_name: "",
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
      queue_name: "",
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
