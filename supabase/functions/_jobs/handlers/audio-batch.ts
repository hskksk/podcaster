import type { GeminiBatchTtsClient } from "../../../../packages/gemini-batch-tts/src/index.ts";
import {
  fetchBatchTtsAsWav,
  getBatchStatus,
  submitBatchTts,
} from "../../../../packages/gemini-batch-tts/src/index.ts";
import { resolveGeminiApiRoot, normalizeGeminiApiRootForEdge } from "../../_adapters/gemini/endpoint.ts";
import {
  buildTtsPrompt,
  DEFAULT_TTS_CHUNK_MAX_CHARS,
  splitTranscriptIntoChunks,
} from "../../../../shared/tts-prompt.ts";

export const AUDIO_BATCH_PENDING_STATES = new Set([
  "JOB_STATE_QUEUED",
  "JOB_STATE_PENDING",
  "JOB_STATE_RUNNING",
  "JOB_STATE_CANCELLING",
  "JOB_STATE_UPDATING",
  "JOB_STATE_PAUSED",
]);

export const AUDIO_BATCH_SUCCESS_STATES = new Set(["JOB_STATE_SUCCEEDED"]);

export const AUDIO_BATCH_FAILURE_STATES = new Set([
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
]);

const DEFAULT_GEMINI_API_VERSION = "v1beta";

export function normalizeBatchState(state: string): string {
  if (state.startsWith("BATCH_STATE_")) {
    return `JOB_STATE_${state.slice("BATCH_STATE_".length)}`;
  }
  return state;
}

export function resolveGeminiApiKey(apiRoot: string): string {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (apiKey && apiKey.length > 0) return apiKey;
  if (apiRoot !== "https://generativelanguage.googleapis.com") {
    return "mock-api-key";
  }
  throw new Error("GEMINI_API_KEY is required when using the default Gemini API endpoint");
}

export function createGeminiBatchTtsClient(params: {
  apiRoot: string;
  model: string;
}): GeminiBatchTtsClient {
  const apiRoot = normalizeGeminiApiRootForEdge(params.apiRoot.replace(/\/+$/, ""));
  return {
    apiKey: resolveGeminiApiKey(apiRoot),
    apiRoot,
    apiVersion: DEFAULT_GEMINI_API_VERSION,
    model: params.model,
  };
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function normalizeSelectionMode(value: unknown): "fixed" | "random" {
  return value === "random" ? "random" : "fixed";
}

export function resolveSelectedValue(
  mode: "fixed" | "random",
  options: string[],
  fixedValue: string,
): string {
  const normalizedFixed = fixedValue.trim();
  if (mode === "fixed") return normalizedFixed || options[0] || "";
  if (options.length === 0) return normalizedFixed;
  return options[Math.floor(Math.random() * options.length)]!;
}

export function buildChunkPrompts(
  scriptContent: string,
  profile: Record<string, unknown>,
): { chunkPrompts: string[]; casting: Record<string, unknown>; ttsModel: string; apiRoot: string } {
  const geminiApiRoot = resolveGeminiApiRoot(profile as Record<string, string>);
  const ttsModel = String(profile["tts.model"] || "gemini-3.1-flash-tts-preview");
  const selectionMode = normalizeSelectionMode(profile["tts.selection_mode"]);
  const hostName = String(profile["tts.host.name"] || "Host");
  const cohostName = String(profile["tts.cohost.name"] || "CoHost");
  const hostVoiceOptions = normalizeStringArray(profile["tts.host.voice_options"]);
  const cohostVoiceOptions = normalizeStringArray(profile["tts.cohost.voice_options"]);
  const hostToneOptions = normalizeStringArray(profile["tts.host.tone_options"]);
  const cohostToneOptions = normalizeStringArray(profile["tts.cohost.tone_options"]);

  const hostVoice = resolveSelectedValue(
    selectionMode,
    hostVoiceOptions,
    String(profile["tts.host.voice"] || "Charon"),
  );
  const cohostVoice = resolveSelectedValue(
    selectionMode,
    cohostVoiceOptions,
    String(profile["tts.cohost.voice"] || "Achird"),
  );
  const hostTone = resolveSelectedValue(
    selectionMode,
    hostToneOptions,
    String(profile["tts.host.tone"] || "落ち着いて信頼感のある進行"),
  );
  const cohostTone = resolveSelectedValue(
    selectionMode,
    cohostToneOptions,
    String(profile["tts.cohost.tone"] || "親しみやすく好奇心のある受け答え"),
  );

  const configuredChunkChars = Number(profile["tts.chunk_max_chars"]);
  const chunkMaxChars = Number.isFinite(configuredChunkChars) && configuredChunkChars >= 100
    ? configuredChunkChars
    : DEFAULT_TTS_CHUNK_MAX_CHARS;

  const chunkPrompts = splitTranscriptIntoChunks(scriptContent, {
    maxChars: chunkMaxChars,
    speakerNames: [hostName, cohostName],
  }).map((transcript) =>
    buildTtsPrompt({
      instructions: String(profile["tts.instructions"] ?? ""),
      host: { name: hostName, tone: hostTone },
      cohost: { name: cohostName, tone: cohostTone },
      transcript,
    })
  );

  return {
    chunkPrompts,
    ttsModel,
    apiRoot: geminiApiRoot,
    casting: {
      mode: selectionMode,
      host: { name: hostName, voice: hostVoice, tone: hostTone },
      cohost: { name: cohostName, voice: cohostVoice, tone: cohostTone },
    },
  };
}

export async function submitAudioBatch(params: {
  profile: Record<string, unknown>;
  scriptId: string;
  scriptContent: string;
  jobId: string;
}): Promise<{ batchName: string; requestCount: number; apiRoot: string; casting: Record<string, unknown> }> {
  const { chunkPrompts, ttsModel, apiRoot, casting } = buildChunkPrompts(
    params.scriptContent,
    params.profile,
  );
  const batchClient = createGeminiBatchTtsClient({ apiRoot, model: ttsModel });
  const host = casting.host as { name: string; voice: string };
  const cohost = casting.cohost as { name: string; voice: string };

  const batchJob = await submitBatchTts(batchClient, {
    scriptText: chunkPrompts,
    host: { name: host.name, voice: host.voice },
    cohost: { name: cohost.name, voice: cohost.voice },
    displayName: `podcaster-job-${params.jobId}`,
    requestKey: params.scriptId,
  });

  return {
    batchName: batchJob.batchName,
    requestCount: batchJob.requestCount,
    apiRoot,
    casting,
  };
}

export async function pollBatch(batchName: string, apiRoot: string, ttsModel: string) {
  const client = createGeminiBatchTtsClient({ apiRoot, model: ttsModel });
  const status = await getBatchStatus(client, batchName);
  return { client, status, state: normalizeBatchState(status.state) };
}

export async function downloadBatchWav(params: {
  batchName: string;
  apiRoot: string;
  ttsModel: string;
  expectedCount?: number;
  outPath: string;
}) {
  const client = createGeminiBatchTtsClient({
    apiRoot: params.apiRoot,
    model: params.ttsModel,
  });
  return await fetchBatchTtsAsWav(client, {
    batchName: params.batchName,
    outPath: params.outPath,
    expectedCount: params.expectedCount,
  });
}
