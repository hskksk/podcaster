import { GoogleGenAI, JobState } from "npm:@google/genai";

const DEFAULT_GEMINI_API_ROOT = "https://generativelanguage.googleapis.com";
const MOCK_API_KEY = "mock-api-key";

type AudioBatchStartResult = {
  jobName: string;
  state: JobState;
};

type AudioBatchPollResult = {
  jobName: string;
  state: JobState;
  response?: unknown;
  error?: unknown;
  metadata?: Record<string, string>;
};

type GeminiProviderOptions = {
  apiRoot?: string;
};

function normalizeApiRootForComparison(root: string): string {
  return root.replace(/\/+$/, "");
}

function resolveApiRoot(rawApiRoot?: string): string {
  const root = rawApiRoot?.trim();
  if (root && root.length > 0) {
    return root;
  }
  return DEFAULT_GEMINI_API_ROOT;
}

function resolveApiKey(apiRoot: string): string {
  const envApiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (envApiKey && envApiKey.length > 0) {
    return envApiKey;
  }

  // Allow local/mock api root to run without a real Gemini API key.
  const normalizedApiRoot = normalizeApiRootForComparison(apiRoot);
  const normalizedDefaultApiRoot = normalizeApiRootForComparison(DEFAULT_GEMINI_API_ROOT);
  if (normalizedApiRoot !== normalizedDefaultApiRoot) {
    return MOCK_API_KEY;
  }

  throw new Error("GEMINI_API_KEY is required when using the default Gemini API Root");
}

function createGeminiClient(options: GeminiProviderOptions = {}): GoogleGenAI {
  const apiRoot = resolveApiRoot(options.apiRoot);
  const apiKey = resolveApiKey(apiRoot);

  const httpOptions = {
    baseUrl: apiRoot,
  };

  return new GoogleGenAI({
    apiKey,
    httpOptions,
  });
}

export async function generateScriptWithGemini(
  params: {
    model: string;
    systemInstruction: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    config: Record<string, unknown>;
  },
  options: GeminiProviderOptions = {},
): Promise<unknown> {
  const gemini = createGeminiClient(options);
  return await gemini.models.generateContent(params);
}

export async function generateAudioWithGemini(
  params: {
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    config: Record<string, unknown>;
  },
  options: GeminiProviderOptions = {},
): Promise<unknown> {
  const gemini = createGeminiClient(options);
  return await gemini.models.generateContent(params);
}

export async function startAudioBatchWithGemini(
  params: {
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    config: Record<string, unknown>;
    metadata?: Record<string, string>;
    displayName?: string;
  },
  options: GeminiProviderOptions = {},
): Promise<AudioBatchStartResult> {
  const gemini = createGeminiClient(options);
  const batchJob = await gemini.batches.create({
    model: params.model,
    src: [{
      model: params.model,
      contents: params.contents,
      config: params.config,
      ...(params.metadata ? { metadata: params.metadata } : {}),
    }],
    ...(params.displayName ? { config: { displayName: params.displayName } } : {}),
  });

  if (!batchJob.name) {
    throw new Error("Gemini batch job name is missing");
  }

  return {
    jobName: batchJob.name,
    state: batchJob.state ?? JobState.JOB_STATE_UNSPECIFIED,
  };
}

export async function pollAudioBatchWithGemini(
  params: {
    jobName: string;
  },
  options: GeminiProviderOptions = {},
): Promise<AudioBatchPollResult> {
  const gemini = createGeminiClient(options);
  const batchJob = await gemini.batches.get({ name: params.jobName });
  const inlinedResponse = batchJob.dest?.inlinedResponses?.[0];

  return {
    jobName: batchJob.name ?? params.jobName,
    state: batchJob.state ?? JobState.JOB_STATE_UNSPECIFIED,
    response: inlinedResponse?.response,
    error: batchJob.error ?? inlinedResponse?.error,
    metadata: inlinedResponse?.metadata,
  };
}
