// Pinned on purpose. @google/genai 3.x changed the default API version from
// v1beta to v1, where preview models such as gemini-3-flash-preview are not
// served, and every job started failing with a 404. Keep this version in sync
// with the `@google/genai` dependency in package.json.
import { GoogleGenAI } from "npm:@google/genai@2.31.0";

const DEFAULT_GEMINI_API_ROOT = "https://generativelanguage.googleapis.com";
const MOCK_API_KEY = "mock-api-key";

/**
 * Set explicitly so that bumping the SDK can never silently switch the
 * endpoint. Matches `gemini.api_path` in config.toml.
 */
const GEMINI_API_VERSION = "v1beta";

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
    apiVersion: GEMINI_API_VERSION,
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
