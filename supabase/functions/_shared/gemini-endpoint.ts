import type { PodcastConfigMap } from "./types.ts";

export const DEFAULT_GEMINI_API_ROOT = "https://generativelanguage.googleapis.com";
export const DEFAULT_GEMINI_API_PATH = "/v1beta";

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
