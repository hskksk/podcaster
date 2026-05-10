import type { PodcastConfigMap } from "./types.ts";

export const DEFAULT_GEMINI_API_ROOT = "https://generativelanguage.googleapis.com";
export const DEFAULT_GEMINI_API_PATH = "/v1beta";
export const DEFAULT_GEMINI_JWKS_PATH = "/.well-known/jwks.json";
export const DEFAULT_GEMINI_WEBHOOK_CALLBACK_PATH = "/functions/v1/audio-batch-callback";

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function joinRootAndPath(root: string, path: string): string {
  const normalizedRoot = root.replace(/\/+$/, "");
  return `${normalizedRoot}${normalizePath(path)}`;
}

export function resolveGeminiApiRoot(config: PodcastConfigMap): string {
  const rootFromConfig = String(config["gemini.api_root"] ?? "").trim();
  if (rootFromConfig) return rootFromConfig.replace(/\/+$/, "");
  return DEFAULT_GEMINI_API_ROOT;
}

export function resolveGeminiApiEndpoint(config: PodcastConfigMap): string {
  const root = resolveGeminiApiRoot(config);
  const path = String(config["gemini.api_path"] ?? "").trim() || DEFAULT_GEMINI_API_PATH;
  return joinRootAndPath(root, path);
}

export function resolveGeminiWebhookCallbackUrl(): string {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") ?? "").trim();
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL environment variable is required to resolve webhook callback URL");
  }
  return joinRootAndPath(supabaseUrl, DEFAULT_GEMINI_WEBHOOK_CALLBACK_PATH);
}

export function resolveGeminiJwksUrl(config: PodcastConfigMap): string {
  const path = String(config["gemini.webhook_jwks_path"] ?? "").trim();
  const resolvedPath = path || DEFAULT_GEMINI_JWKS_PATH;
  return joinRootAndPath(resolveGeminiApiRoot(config), resolvedPath);
}
