import "server-only";

import { Octokit } from "@octokit/rest";
import { githubRepo } from "../storage";
import type { CaptureWriteResult } from "./types";

function token(): string {
  return (process.env.CAPTURE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "").trim();
}

function branch(): string {
  return (process.env.CAPTURE_GITHUB_BRANCH || "main").trim();
}

function ownerRepo(): { owner: string; repo: string } {
  const [owner, repo] = githubRepo.split("/");
  if (!owner || !repo) throw new Error("Invalid githubRepo");
  return { owner, repo };
}

export function githubCaptureReady(): boolean {
  return Boolean(token());
}

function octokit(): Octokit {
  return new Octokit({ auth: token() });
}

export async function githubGetFile(
  path: string,
): Promise<{ sha: string; text: string } | null> {
  const { owner, repo } = ownerRepo();
  try {
    const { data } = await octokit().repos.getContent({
      owner,
      repo,
      path,
      ref: branch(),
    });
    if (Array.isArray(data) || data.type !== "file" || !("content" in data) || !data.sha) {
      return null;
    }
    const text = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
    return { sha: data.sha, text };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return null;
    throw err;
  }
}

export async function githubPutFile(opts: {
  path: string;
  content: string;
  message: string;
  existingSha?: string;
}): Promise<CaptureWriteResult> {
  const { owner, repo } = ownerRepo();
  const { data } = await octokit().repos.createOrUpdateFileContents({
    owner,
    repo,
    path: opts.path,
    message: opts.message,
    content: Buffer.from(opts.content, "utf8").toString("base64"),
    branch: branch(),
    ...(opts.existingSha ? { sha: opts.existingSha } : {}),
  });
  const sha = data.commit.sha ?? data.content?.sha ?? "";
  return { path: opts.path, sha, committed: true };
}
