import "server-only";

import { isGithubStorage } from "../storage";
import { githubCaptureReady, githubGetFile, githubPutFile } from "./github";
import { fsGetFile, fsPutFile } from "./fs-store";
import type { CaptureWriteResult } from "./types";

export function usesGithubCommit(): boolean {
  return isGithubStorage();
}

export async function readCaptureFile(
  rel: string,
): Promise<{ sha: string; text: string } | null> {
  if (usesGithubCommit()) return githubGetFile(rel);
  return fsGetFile(rel);
}

export async function writeCaptureFile(opts: {
  path: string;
  content: string;
  message: string;
  existingSha?: string;
}): Promise<CaptureWriteResult> {
  if (usesGithubCommit()) {
    if (!githubCaptureReady()) {
      throw Object.assign(new Error("GITHUB_TOKEN (or CAPTURE_GITHUB_TOKEN) is not set"), {
        status: 503,
      });
    }
    return githubPutFile(opts);
  }
  return fsPutFile(opts.path, opts.content);
}
