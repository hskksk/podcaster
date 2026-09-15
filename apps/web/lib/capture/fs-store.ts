import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getRepoRoot } from "../repo-root";
import type { CaptureWriteResult } from "./types";

function abs(rel: string): string {
  return path.join(getRepoRoot(), rel);
}

export function fsGetFile(rel: string): { sha: string; text: string } | null {
  const full = abs(rel);
  if (!fs.existsSync(full)) return null;
  const text = fs.readFileSync(full, "utf8");
  const sha = createHash("sha256").update(text).digest("hex");
  return { sha, text };
}

export function fsPutFile(rel: string, content: string): CaptureWriteResult {
  const full = abs(rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  const sha = createHash("sha256").update(content).digest("hex");
  return { path: rel, sha: `local:${sha}`, committed: false };
}
