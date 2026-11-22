/**
 * Knowledge corpus paths (private `hskksk/knowledges` layout).
 * Read from CONTENT_ROOT / KEYSTATIC_LOCAL_BASE / `.knowledge-checkout` only —
 * not from podcaster's in-repo `content/`.
 */

import fs from "node:fs";
import path from "node:path";

export const AI_PODCAST_REL = "content/ai-podcast";
export const LEGACY_DOCS_REL = "content/docs";
export const NOTES_REL = "notes";
export const LEGACY_CLIPS_REL = "content/web-clips";
export const JUKEN_REL = "content/juken";
export const LEGACY_JUKEN_REL = "chugaku-juken";

const SAFE_PATH_RE =
  /^(content\/(?:ai-podcast|docs|web-clips)|notes)\/[^/]+\/index\.mdoc$/;

export function assertSafeKnowledgePath(rel: string): boolean {
  if (rel.includes("..") || rel.includes("\\") || rel.includes("\0")) return false;
  return SAFE_PATH_RE.test(rel);
}

export function getMonorepoRoot(): string {
  if (process.env.PODCASTER_ROOT) {
    return path.resolve(process.env.PODCASTER_ROOT);
  }
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function getContentRoot(): string {
  if (process.env.CONTENT_ROOT) {
    return path.resolve(process.env.CONTENT_ROOT);
  }
  if (process.env.KEYSTATIC_LOCAL_BASE) {
    return path.resolve(process.env.KEYSTATIC_LOCAL_BASE);
  }
  return path.join(getMonorepoRoot(), ".knowledge-checkout");
}

export function aiPodcastDir(): string {
  const root = getContentRoot();
  const next = path.join(root, AI_PODCAST_REL);
  if (fs.existsSync(next)) return next;
  return path.join(root, LEGACY_DOCS_REL);
}

export function notesDir(): string {
  const root = getContentRoot();
  const next = path.join(root, NOTES_REL);
  if (fs.existsSync(next)) return next;
  return path.join(root, LEGACY_CLIPS_REL);
}

export function jukenDir(): string {
  return path.join(getContentRoot(), JUKEN_REL);
}

export function aiPodcastRelPrefix(): string {
  const root = getContentRoot();
  if (fs.existsSync(path.join(root, AI_PODCAST_REL))) return AI_PODCAST_REL;
  return LEGACY_DOCS_REL;
}

export function notesRelPrefix(): string {
  const root = getContentRoot();
  if (fs.existsSync(path.join(root, NOTES_REL))) return NOTES_REL;
  return LEGACY_CLIPS_REL;
}

/** Repo-relative path for Capture / GitHub commits (knowledge repo). */
export function captureEntryPath(collection: "docs" | "web-clips", slug: string): string {
  if (collection === "docs") {
    return `${AI_PODCAST_REL}/${slug}/index.mdoc`;
  }
  return `${NOTES_REL}/${slug}/index.mdoc`;
}

export function collectionFromCapturePath(rel: string): "docs" | "web-clips" | null {
  if (rel.startsWith(`${AI_PODCAST_REL}/`) || rel.startsWith(`${LEGACY_DOCS_REL}/`)) return "docs";
  if (rel.startsWith(`${NOTES_REL}/`) || rel.startsWith(`${LEGACY_CLIPS_REL}/`)) return "web-clips";
  return null;
}

export function aiPodcastContentPathCandidates(dir: string): string[] {
  return [`${AI_PODCAST_REL}/${dir}/index.mdoc`, `${LEGACY_DOCS_REL}/${dir}/index.mdoc`];
}

export type QueuedWalkTarget = { absDir: string; relPrefix: string };

/** Directories to scan for `podcast: queued` (ingest-queued). */
export function queuedIngestWalkTargets(): QueuedWalkTarget[] {
  const root = getContentRoot();
  const out: QueuedWalkTarget[] = [];
  const add = (rel: string) => {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) out.push({ absDir: abs, relPrefix: rel });
  };
  add(AI_PODCAST_REL);
  add(LEGACY_DOCS_REL);
  add(NOTES_REL);
  add(LEGACY_CLIPS_REL);
  return out;
}