import { createHash } from "node:crypto";
import {
  assertSafeKnowledgePath,
  captureEntryPath,
  collectionFromCapturePath,
} from "../../../../scripts/lib/content-paths";
import { slugFromTitle } from "../slug";
import type { CaptureCollection } from "./frontmatter";

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
  return captureEntryPath(collection, slug);
}

export function assertSafeContentPath(relPath: string): boolean {
  return assertSafeKnowledgePath(relPath);
}

export function collectionFromPath(relPath: string): CaptureCollection | null {
  return collectionFromCapturePath(relPath);
}
