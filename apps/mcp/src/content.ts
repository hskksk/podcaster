import fs from "node:fs";
import path from "node:path";
import {
  AI_PODCAST_REL,
  LEGACY_CLIPS_REL,
  LEGACY_DOCS_REL,
  NOTES_REL,
  assertSafeKnowledgePath,
  aiPodcastDir,
  getContentRoot,
  notesDir,
} from "../../../scripts/lib/content-paths.js";

export function assertSafeContentPath(rel: string): boolean {
  return assertSafeKnowledgePath(rel);
}

export function repoRoot(): string {
  return getContentRoot();
}

export function githubRepo(): { owner: string; repo: string; ref: string } {
  const spec = (
    process.env.KNOWLEDGE_GITHUB_REPO ||
    process.env.KEYSTATIC_GITHUB_REPO ||
    process.env.GITHUB_REPO ||
    "hskksk/knowledges"
  ).trim();
  const [owner, repo] = spec.split("/");
  return {
    owner: owner || "hskksk",
    repo: repo || "blog",
    ref: (process.env.KNOWLEDGE_GIT_REF || process.env.GITHUB_REF || "main").trim(),
  };
}

function readToken(): string {
  return (process.env.GITHUB_READ_TOKEN || "").trim();
}

export function hasGithubRead(): boolean {
  return Boolean(readToken());
}

export function hasLocalContent(): boolean {
  const root = getContentRoot();
  return (
    fs.existsSync(path.join(root, AI_PODCAST_REL)) || fs.existsSync(path.join(root, LEGACY_DOCS_REL))
  );
}

async function githubGet(urlPath: string, accept: string): Promise<Response> {
  const token = readToken();
  if (!token) throw new Error("GITHUB_READ_TOKEN is not set");
  const res = await fetch(`https://api.github.com${urlPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      "User-Agent": "podcaster-mcp",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`GitHub ${res.status}: ${text}`);
  }
  return res;
}

function listLocalPaths(): string[] {
  const out: string[] = [];
  const wikiDir = aiPodcastDir();
  if (fs.existsSync(wikiDir)) {
    const rel = wikiDir.replace(/\\/g, "/").endsWith(`/${AI_PODCAST_REL}`)
      ? AI_PODCAST_REL
      : LEGACY_DOCS_REL;
    for (const ent of fs.readdirSync(wikiDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const p = `${rel}/${ent.name}/index.mdoc`;
      if (fs.existsSync(path.join(getContentRoot(), p))) out.push(p);
    }
  }
  const clipRoot = notesDir();
  if (fs.existsSync(clipRoot)) {
    const rel = clipRoot.replace(/\\/g, "/").endsWith(`/${NOTES_REL}`) ? NOTES_REL : LEGACY_CLIPS_REL;
    for (const ent of fs.readdirSync(clipRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const p = `${rel}/${ent.name}/index.mdoc`;
      if (fs.existsSync(path.join(getContentRoot(), p))) out.push(p);
    }
  }
  return out.sort();
}

export async function listMdocPaths(): Promise<string[]> {
  if (hasLocalContent()) {
    return listLocalPaths();
  }
  if (!hasGithubRead()) {
    throw new Error("No knowledge checkout and GITHUB_READ_TOKEN is unset");
  }
  const { owner, repo, ref } = githubRepo();
  const res = await githubGet(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    "application/vnd.github+json",
  );
  const data = (await res.json()) as { tree?: Array<{ path?: string; type?: string }> };
  return (data.tree ?? [])
    .filter((t) => t.type === "blob" && t.path && assertSafeContentPath(t.path))
    .map((t) => t.path as string)
    .sort();
}

export async function readMdoc(rel: string): Promise<string> {
  if (!assertSafeContentPath(rel)) throw new Error(`Refusing path: ${rel}`);
  if (hasLocalContent()) {
    const full = path.join(getContentRoot(), rel);
    if (!fs.existsSync(full)) throw new Error(`Not found: ${rel}`);
    return fs.readFileSync(full, "utf8");
  }
  if (!hasGithubRead()) {
    throw new Error("No knowledge checkout and GITHUB_READ_TOKEN is unset");
  }
  const { owner, repo, ref } = githubRepo();
  const res = await githubGet(
    `/repos/${owner}/${repo}/contents/${rel}?ref=${encodeURIComponent(ref)}`,
    "application/vnd.github.raw",
  );
  return res.text();
}

export function snippet(haystack: string, query: string, radius = 80): string {
  const i = haystack.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return haystack.slice(0, radius * 2);
  const start = Math.max(0, i - radius);
  const end = Math.min(haystack.length, i + query.length + radius);
  return (start > 0 ? "…" : "") + haystack.slice(start, end).replace(/\s+/g, " ") + (end < haystack.length ? "…" : "");
}