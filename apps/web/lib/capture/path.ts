import { createHash } from "node:crypto";
import { slugFromTitle } from "../slug";
import type { CaptureCollection } from "./frontmatter";

const PATH_RE = /^content\/(docs|web-clips)\/[^/]+\/index\.mdoc$/;

export function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function datedSlug(title: string, slugOverride?: string): string {
  const today = todayUtcDate();
  const base = slugOverride?.trim() ? slugFromTitle(slugOverride) : slugFromTitle(title);
  if (/^\d{4}-\d{2}-\d{2}-/.test(base)) return base;
  return `${today}-${base}`;
}

export function shortHash(input: string, len = 6): string {
  return createHash("sha256").update(input).digest("hex").slice(0, len);
}

export function entryPath(collection: CaptureCollection, slug: string): string {
  return `content/${collection}/${slug}/index.mdoc`;
}

export function assertSafeContentPath(path: string): boolean {
  if (path.includes("..") || path.includes("\\") || path.includes("\0")) return false;
  return PATH_RE.test(path);
}

export function collectionFromPath(path: string): CaptureCollection | null {
  const m = path.match(/^content\/(docs|web-clips)\//);
  if (m?.[1] === "docs" || m?.[1] === "web-clips") return m[1];
  return null;
}
