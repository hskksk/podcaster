#!/usr/bin/env node
/**
 * Copy `content/docs` + `config.toml` into `apps/web/.data/` so the Vercel
 * serverless bundle can read them. Root Directory is `apps/web`, so files
 * outside that folder are available at build but not in the lambda.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(appDir, ".data");

function findRepoRoot() {
  let dir = appDir;
  for (let i = 0; i < 8; i++) {
    if (
      existsSync(join(dir, "pnpm-workspace.yaml")) ||
      existsSync(join(dir, "content", "docs"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const repoRoot = findRepoRoot();
const docsSrc = repoRoot ? join(repoRoot, "content", "docs") : "";
const tomlSrc = repoRoot ? join(repoRoot, "config.toml") : "";

if (!docsSrc || !existsSync(docsSrc)) {
  console.error("[sync-site-data] content/docs not found. repoRoot=", repoRoot, "cwd=", process.cwd());
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(join(dest, "content"), { recursive: true });
cpSync(docsSrc, join(dest, "content", "docs"), { recursive: true });
if (tomlSrc && existsSync(tomlSrc)) {
  cpSync(tomlSrc, join(dest, "config.toml"));
}

console.log("[sync-site-data] copied content/docs + config.toml ->", dest);
