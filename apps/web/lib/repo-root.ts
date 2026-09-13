import "server-only";
import fs from "node:fs";
import path from "node:path";

/** Walk up from cwd until pnpm-workspace.yaml is found. Server-only. */
export function getRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find repository root (pnpm-workspace.yaml)");
}
