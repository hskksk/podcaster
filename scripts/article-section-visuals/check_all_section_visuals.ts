#!/usr/bin/env tsx
/**
 * Validate every section-visuals.yml under content/docs and content/web-clips.
 * Missing sidecars are not an error.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function getRepoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

function walkSidecars(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    const mdoc = join(dir, "index.mdoc");
    const sidecar = join(dir, "section-visuals.yml");
    if (existsSync(mdoc) && existsSync(sidecar)) out.push(mdoc);
  }
  return out;
}

const repo = getRepoRoot();
const paths = [
  ...walkSidecars(join(repo, "content", "docs")),
  ...walkSidecars(join(repo, "content", "web-clips")),
];

if (paths.length === 0) {
  console.log("section-visuals:check — no sidecars found (ok)");
  process.exit(0);
}

let failed = false;
for (const mdoc of paths) {
  try {
    execSync(`pnpm exec tsx scripts/article-section-visuals/validate_section_visuals.ts "${mdoc}"`, {
      cwd: repo,
      stdio: "inherit",
    });
  } catch {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
