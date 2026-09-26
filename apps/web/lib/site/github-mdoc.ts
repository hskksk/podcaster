import "server-only";

import fs from "node:fs";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import { createGitHubReader } from "@keystatic/core/reader/github";
import config from "../../keystatic.config";
import { getRepoRoot } from "../repo-root";
import { githubRepo } from "../storage";
import { publicDocFromMdocSource, publicWebClipFromMdocSource } from "./mdoc-public";
import type { PublicDoc } from "./docs";
import type { PublicWebClip } from "./web-clips";

const [owner, repo] = githubRepo.split("/") as [string, string];

function mdocPath(collection: "docs" | "webClips", entryDir: string): string {
  const segment = collection === "docs" ? "docs" : "web-clips";
  return `content/${segment}/${entryDir}/index.mdoc`;
}

export function readLocalMdoc(collection: "docs" | "webClips", entryDir: string): string | null {
  const segment = collection === "docs" ? "docs" : "web-clips";
  const file = path.join(getRepoRoot(), "content", segment, entryDir, "index.mdoc");
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

export async function readMdocFromGithub(
  collection: "docs" | "webClips",
  entryDir: string,
  ref: string,
  token?: string,
): Promise<string | null> {
  const octokit = new Octokit(token ? { auth: token } : {});
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      path: mdocPath(collection, entryDir),
      ref,
    });
    if (Array.isArray(res.data) || res.data.type !== "file") return null;
    return Buffer.from(res.data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

async function listEntryDirs(collection: "docs" | "webClips", ref: string, token?: string): Promise<string[]> {
  const reader = createGitHubReader(config, { repo: githubRepo, ref, token });
  const list =
    collection === "docs"
      ? await reader.collections.docs.all()
      : await reader.collections.webClips.all();
  return list.map((e) => e.slug);
}

export async function loadPublicDocsFromRef(ref: string, token?: string): Promise<PublicDoc[]> {
  const dirs = await listEntryDirs("docs", ref, token);
  const docs = await Promise.all(
    dirs.map(async (dir) => {
      const source = await readMdocFromGithub("docs", dir, ref, token);
      return source ? publicDocFromMdocSource(dir, source) : null;
    }),
  );
  return docs.filter((d): d is PublicDoc => d !== null).sort((a, b) => b.filename.localeCompare(a.filename, "en"));
}

export async function loadPublicWebClipsFromRef(ref: string, token?: string): Promise<PublicWebClip[]> {
  const dirs = await listEntryDirs("webClips", ref, token);
  const clips = await Promise.all(
    dirs.map(async (dir) => {
      const source = await readMdocFromGithub("webClips", dir, ref, token);
      return source ? publicWebClipFromMdocSource(dir, source) : null;
    }),
  );
  return clips
    .filter((c): c is PublicWebClip => c !== null)
    .sort((a, b) => b.filename.localeCompare(a.filename, "en"));
}

export async function resolvePublicPathForEntry(
  collection: "docs" | "webClips",
  entryDir: string,
  ref?: string,
  token?: string,
): Promise<string | null> {
  const source = ref
    ? await readMdocFromGithub(collection, entryDir, ref, token)
    : readLocalMdoc(collection, entryDir);
  if (!source) return null;
  return collection === "docs"
    ? `/articles/${publicDocFromMdocSource(entryDir, source).slug}`
    : `/web-clips/${publicWebClipFromMdocSource(entryDir, source).slug}`;
}
