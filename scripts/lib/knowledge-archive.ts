/**
 * Fetch knowledges as a GitHub tarball into a directory (no git binary).
 * Used by Vercel on-demand revalidation when the build-time checkout is absent.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function readLockRepo(): string | null {
  const root = process.env.PODCASTER_ROOT?.trim();
  const repoRoot = root ? path.resolve(root) : path.resolve(import.meta.dirname, "../..");
  const lockPath = path.join(repoRoot, "knowledge.lock.json");
  if (!fs.existsSync(lockPath)) return null;
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8")) as { repo?: string; ref?: string };
    return lock.repo?.trim() || null;
  } catch {
    return null;
  }
}

export function knowledgeGithubRepo(): string {
  const fromEnv = process.env.KNOWLEDGE_GITHUB_REPO?.trim();
  if (fromEnv) return fromEnv;
  const fromLock = readLockRepo();
  if (fromLock) return fromLock;
  throw new Error("KNOWLEDGE_GITHUB_REPO is required for runtime knowledge fetch");
}

export function knowledgeGithubRef(): string {
  const fromRef = process.env.KNOWLEDGE_GIT_REF?.trim();
  if (fromRef) return fromRef;
  const fromSha = process.env.KNOWLEDGE_GIT_SHA?.trim();
  if (fromSha) return fromSha;
  return "main";
}

export function knowledgeContentPresent(root: string): boolean {
  const base = path.join(root, "content");
  return (
    fs.existsSync(path.join(base, "ai-podcast")) ||
    fs.existsSync(path.join(base, "docs")) ||
    fs.existsSync(path.join(base, "juken"))
  );
}

/** Extract `owner/repo` tarball ref into `dest` (wiped first). */
export function extractKnowledgeArchive(dest: string): void {
  const token = process.env.KNOWLEDGE_GITHUB_TOKEN?.trim();
  if (!token) {
    throw new Error("KNOWLEDGE_GITHUB_TOKEN is required for runtime knowledge fetch");
  }
  const fullRepo = knowledgeGithubRepo();
  const [owner, repo] = fullRepo.split("/");
  if (!owner || !repo) throw new Error(`Invalid KNOWLEDGE_GITHUB_REPO: ${fullRepo}`);
  const ref = knowledgeGithubRef();

  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  const url = `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(ref)}`;
  const tarball = path.join(dest, "..", `.knowledge-tarball-${process.pid}.tar.gz`);
  execFileSync(
    "curl",
    [
      "-fsSL",
      "-H",
      `Authorization: Bearer ${token}`,
      "-H",
      "Accept: application/vnd.github+json",
      "-o",
      tarball,
      url,
    ],
    { stdio: "inherit" },
  );
  execFileSync("tar", ["-xzf", tarball, "-C", dest, "--strip-components=1"], { stdio: "inherit" });
  fs.rmSync(tarball, { force: true });

  if (!knowledgeContentPresent(dest)) {
    throw new Error(`Knowledge tarball at ${dest} did not contain expected content/ trees`);
  }
}