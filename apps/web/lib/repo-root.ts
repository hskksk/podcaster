import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Directory that contains `content/` (and usually `pnpm-workspace.yaml`).
 * Server-only. Never throws — callers fall back to empty lists / cwd.
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
