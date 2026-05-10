import { GoogleGenAI, JobState } from "npm:@google/genai";

const DEFAULT_GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com";
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
  apiEndpoint?: string;
};

function normalizeEndpointForComparison(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

function resolveApiEndpoint(rawEndpoint?: string): string {
  const endpoint = rawEndpoint?.trim();
  if (endpoint && endpoint.length > 0) {
    return endpoint;
  }
  return DEFAULT_GEMINI_API_ENDPOINT;
}

function resolveApiKey(apiEndpoint: string): string {
  const envApiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (envApiKey && envApiKey.length > 0) {
    return envApiKey;
  }

  // Allow local/mock endpoints to run without a real Gemini API key.
  const normalizedEndpoint = normalizeEndpointForComparison(apiEndpoint);
  const normalizedDefaultEndpoint = normalizeEndpointForComparison(DEFAULT_GEMINI_API_ENDPOINT);
  if (normalizedEndpoint !== normalizedDefaultEndpoint) {
    return MOCK_API_KEY;
  }

  throw new Error("GEMINI_API_KEY is required when using the default Gemini API endpoint");
}

function createGeminiClient(options: GeminiProviderOptions = {}): GoogleGenAI {
  const apiEndpoint = resolveApiEndpoint(options.apiEndpoint);
  const apiKey = resolveApiKey(apiEndpoint);

  const httpOptions = {
    baseUrl: apiEndpoint,
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
