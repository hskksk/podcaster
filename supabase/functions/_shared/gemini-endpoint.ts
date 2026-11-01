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
  if (rootFromConfig) return normalizeGeminiApiRootForEdge(rootFromConfig.replace(/\/+$/, ""));
  return DEFAULT_GEMINI_API_ROOT;
}

/** Edge runtime runs in Docker; 127.0.0.1 / localhost in config must reach the host mock. */
export function normalizeGeminiApiRootForEdge(root: string): string {
  if (typeof Deno === "undefined") return root;
  return root
    .replace(/\/\/127\.0\.0\.1(?=[:/])/g, "//host.docker.internal")
    .replace(/\/\/localhost(?=[:/])/g, "//host.docker.internal");
}

export function resolveGeminiApiEndpoint(config: PodcastConfigMap): string {
  const root = resolveGeminiApiRoot(config);
  const path = String(config["gemini.api_path"] ?? "").trim() || DEFAULT_GEMINI_API_PATH;
  return joinRootAndPath(root, path);
}
