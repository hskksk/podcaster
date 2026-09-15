import fs from "node:fs";
import path from "node:path";

const PATH_RE = /^content\/(docs|web-clips)\/[^/]+\/index\.mdoc$/;

export function assertSafeContentPath(rel: string): boolean {
  if (rel.includes("..") || rel.includes("\\") || rel.includes("\0")) return false;
  return PATH_RE.test(rel);
}

export function repoRoot(): string {
  if (process.env.CONTENT_ROOT) return process.env.CONTENT_ROOT;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    if (fs.existsSync(path.join(dir, "content", "docs"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function githubRepo(): { owner: string; repo: string; ref: string } {
  const spec = (process.env.GITHUB_REPO || "hskksk/podcaster").trim();
  const [owner, repo] = spec.split("/");
  return {
    owner: owner || "hskksk",
    repo: repo || "podcaster",
    ref: (process.env.GITHUB_REF || "main").trim(),
  };
}

function readToken(): string {
  return (process.env.GITHUB_READ_TOKEN || "").trim();
}

export function hasGithubRead(): boolean {
  return Boolean(readToken());
}

export function hasLocalContent(): boolean {
  return fs.existsSync(path.join(repoRoot(), "content", "docs"));
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

export async function listMdocPaths(): Promise<string[]> {
  if (hasLocalContent()) {
    const root = repoRoot();
    const out: string[] = [];
    for (const collection of ["docs", "web-clips"] as const) {
      const dir = path.join(root, "content", collection);
      if (!fs.existsSync(dir)) continue;
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        const rel = `content/${collection}/${ent.name}/index.mdoc`;
        if (fs.existsSync(path.join(root, rel))) out.push(rel);
      }
    }
    return out.sort();
  }
  if (!hasGithubRead()) {
    throw new Error("No content/ checkout and GITHUB_READ_TOKEN is unset");
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
    const full = path.join(repoRoot(), rel);
    if (!fs.existsSync(full)) throw new Error(`Not found: ${rel}`);
    return fs.readFileSync(full, "utf8");
  }
  if (!hasGithubRead()) {
    throw new Error("No content/ checkout and GITHUB_READ_TOKEN is unset");
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
