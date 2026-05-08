import { GoogleGenAI } from "npm:@google/genai";
import { parse as parseToml } from "npm:smol-toml";

type JsonRecord = Record<string, unknown>;

type ScriptMockConfig = {
  delayMs?: number;
  title?: string;
  description?: string;
  script?: string;
  thoughts?: string[];
  tokenUsage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

type AudioMockConfig = {
  delayMs?: number;
  mimeType?: string;
  sampleRate?: number;
  durationSeconds?: number;
  base64Data?: string;
  tokenUsage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

type GeminiMockConfig = {
  enabled?: boolean;
  script?: ScriptMockConfig;
  audio?: AudioMockConfig;
};

type DevConfig = {
  geminiMock?: GeminiMockConfig;
};

const DEFAULT_SCRIPT = `Host: 皆さんこんにちは。今回は Gemini API のモック実行です。\nCoHost: ローカル開発時に API コストを抑えられるのが嬉しいですね。\nHost: この台本は dev 設定ファイルで自由に差し替え可能です。\nCoHost: 返り値や遅延時間を変えて、失敗ケースの検証もできますね。`;

let cachedConfig: DevConfig | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeJson(text: string): DevConfig | null {
  try {
    return JSON.parse(text) as DevConfig;
  } catch (_err) {
    console.error("[gemini-mock] invalid JSON config");
    return null;
  }
}

function decodeToml(text: string): DevConfig | null {
  try {
    return parseToml(text) as DevConfig;
  } catch (_err) {
    console.error("[gemini-mock] invalid TOML config");
    return null;
  }
}

async function loadDevConfig(): Promise<DevConfig> {
  if (cachedConfig) return cachedConfig;

  const inline = Deno.env.get("GEMINI_MOCK_CONFIG_JSON");
  if (inline && inline.trim().length > 0) {
    cachedConfig = decodeJson(inline) ?? {};
    return cachedConfig;
  }

  const inlineToml = Deno.env.get("GEMINI_MOCK_CONFIG_TOML");
  if (inlineToml && inlineToml.trim().length > 0) {
    cachedConfig = decodeToml(inlineToml) ?? {};
    return cachedConfig;
  }

  const path = Deno.env.get("GEMINI_MOCK_CONFIG_PATH");
  if (path && path.trim().length > 0) {
    try {
      const text = await Deno.readTextFile(path);
      cachedConfig = path.endsWith(".toml")
        ? (decodeToml(text) ?? {})
        : (decodeJson(text) ?? {});
      return cachedConfig;
    } catch (err) {
      console.error(`[gemini-mock] failed to read config at ${path}:`, err);
    }
  }

  cachedConfig = {};
  return cachedConfig;
}

function isMockEnabled(config: DevConfig): boolean {
  if (Deno.env.get("GEMINI_MOCK_ENABLED") === "true") return true;
  return config.geminiMock?.enabled === true;
}

function generateSilencePcmBase64(sampleRate: number, durationSeconds: number): string {
  const totalSamples = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const bytes = new Uint8Array(totalSamples * 2);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createScriptMockResponse(mock: ScriptMockConfig): JsonRecord {
  const title = mock.title ?? "モック台本";
  const description = mock.description ?? "Gemini API モックで生成した台本です。";
  const script = mock.script ?? DEFAULT_SCRIPT;
  const thoughts = mock.thoughts ?? [];

  const payload = JSON.stringify({ title, description, script });
  return {
    text: payload,
    candidates: [{
      content: {
        parts: [
          ...thoughts.map((t) => ({ text: t, thought: true })),
          { text: payload },
        ],
      },
    }],
    usageMetadata: {
      promptTokenCount: mock.tokenUsage?.promptTokenCount ?? 120,
      candidatesTokenCount: mock.tokenUsage?.candidatesTokenCount ?? 380,
      totalTokenCount: mock.tokenUsage?.totalTokenCount ?? 500,
    },
  };
}

function createAudioMockResponse(mock: AudioMockConfig): JsonRecord {
  const sampleRate = mock.sampleRate ?? 24000;
  const durationSeconds = mock.durationSeconds ?? 5;
  const mimeType = mock.mimeType ?? `audio/L16;rate=${sampleRate}`;
  const base64Data = mock.base64Data ?? generateSilencePcmBase64(sampleRate, durationSeconds);

  return {
    candidates: [{
      content: {
        parts: [{
          inlineData: {
            mimeType,
            data: base64Data,
          },
        }],
      },
    }],
    usageMetadata: {
      promptTokenCount: mock.tokenUsage?.promptTokenCount ?? 240,
      candidatesTokenCount: mock.tokenUsage?.candidatesTokenCount ?? 420,
      totalTokenCount: mock.tokenUsage?.totalTokenCount ?? 660,
    },
  };
}

export async function generateScriptWithGemini(params: {
  model: string;
  systemInstruction: string;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  config: Record<string, unknown>;
}): Promise<unknown> {
  const devConfig = await loadDevConfig();
  if (isMockEnabled(devConfig)) {
    const mock = devConfig.geminiMock?.script ?? {};
    if ((mock.delayMs ?? 0) > 0) await sleep(mock.delayMs!);
    return createScriptMockResponse(mock);
  }

  const gemini = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });
  return await gemini.models.generateContent(params);
}

export async function generateAudioWithGemini(params: {
  model: string;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  config: Record<string, unknown>;
}): Promise<unknown> {
  const devConfig = await loadDevConfig();
  if (isMockEnabled(devConfig)) {
    const mock = devConfig.geminiMock?.audio ?? {};
    if ((mock.delayMs ?? 0) > 0) await sleep(mock.delayMs!);
    return createAudioMockResponse(mock);
  }

  const gemini = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });
  return await gemini.models.generateContent(params);
}
