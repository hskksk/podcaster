import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Directory that contains `content/` (and usually `pnpm-workspace.yaml`).
 * Server-only. Never throws — callers fall back to empty lists / cwd.
 *
 * Keystatic local storage and Capture FS writes must use this (the real repo),
 * not the Vercel-only `.data` snapshot.
 */
export function getRepoRoot(): string {
  if (process.env.KEYSTATIC_LOCAL_BASE) {
    return process.env.KEYSTATIC_LOCAL_BASE;
  }

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

/**
 * Where the public site reads `content/docs` and `config.toml`.
 *
 * On Vercel the lambda cwd is `apps/web` and the monorepo `content/` is not
 * in the function bundle. `prebuild` copies docs into `apps/web/.data/`.
 * Locally / Docker, the live repo still wins so Keystatic edits show up.
 */
export function getSiteDataRoot(): string {
  const bundled = path.join(process.cwd(), ".data");
  const bundledDocs = path.join(bundled, "content", "docs");
  if (!fs.existsSync(bundledDocs)) return getRepoRoot();

  const repo = getRepoRoot();
  if (repo !== bundled && fs.existsSync(path.join(repo, "content", "docs"))) {
    return repo;
  }
  return bundled;
}
