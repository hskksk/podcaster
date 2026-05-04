import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

/** Used for mem-ai `note create` when `--collection-title` is omitted (file mode). */
export const DEFAULT_MEM_COLLECTION_TITLE = "Podcast Drafts";

/**
 * Registers a local markdown file in mem.ai and returns the new note id (same as scripts/ingest.ts).
 */
export function createMemNoteFromFile(filePath: string, collectionTitles: string[]): string {
  const resolved = path.resolve(filePath);
  if (!existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }

  const titles =
    collectionTitles.length > 0 ? collectionTitles : [DEFAULT_MEM_COLLECTION_TITLE];

  const args = ["exec", "mem-ai", "--json", "note", "create", "--file", resolved];
  for (const t of titles) {
    args.push("--collection-title", t);
  }

  const result = spawnSync("pnpm", args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new Error(`Failed to run mem-ai: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const err = result.stderr.trim() || `mem-ai exited with code ${result.status}`;
    throw new Error(err);
  }

  let parsed: { id?: string };
  try {
    parsed = JSON.parse(result.stdout.trim()) as { id?: string };
  } catch {
    throw new Error(`Invalid JSON from mem-ai: ${result.stdout.slice(0, 500)}`);
  }

  const id = parsed.id?.trim();
  if (!id) {
    throw new Error(`mem-ai response missing id: ${result.stdout.slice(0, 500)}`);
  }

  return id;
}
