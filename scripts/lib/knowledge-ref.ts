/**
 * Resolve which knowledges git ref to checkout at build time.
 *
 * Preview: podcaster branch `knowledges-preview/<knowledges-branch>` plus optional
 * `knowledges-preview.lock.json` on that branch (written by knowledges PR workflow).
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const KNOWLEDGES_PREVIEW_BRANCH_PREFIX = "knowledges-preview/";

export type KnowledgeLockFile = { repo?: string; ref?: string; sha?: string };

export function readKnowledgeLock(repoRoot: string): KnowledgeLockFile | null {
  return readJsonLock(path.join(repoRoot, "knowledge.lock.json"));
}

export function readKnowledgesPreviewLock(repoRoot: string): KnowledgeLockFile | null {
  return readJsonLock(path.join(repoRoot, "knowledges-preview.lock.json"));
}

function readJsonLock(lockPath: string): KnowledgeLockFile | null {
  if (!fs.existsSync(lockPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(lockPath, "utf8")) as KnowledgeLockFile;
  } catch {
    return null;
  }
}

/** Vercel injects the deployed Git branch ref (e.g. knowledges-preview/feature/foo). */
export function vercelGitCommitRef(): string | undefined {
  const ref = process.env.VERCEL_GIT_COMMIT_REF?.trim();
  return ref || undefined;
}

/** Maps `knowledges-preview/foo/bar` → knowledges ref `foo/bar`. */
export function knowledgeRefFromPreviewBranch(gitRef: string): string | null {
  if (!gitRef.startsWith(KNOWLEDGES_PREVIEW_BRANCH_PREFIX)) return null;
  const rest = gitRef.slice(KNOWLEDGES_PREVIEW_BRANCH_PREFIX.length).trim();
  return rest || null;
}

export function isKnowledgesPreviewPodcasterBranch(gitRef: string | undefined): boolean {
  return Boolean(gitRef?.startsWith(KNOWLEDGES_PREVIEW_BRANCH_PREFIX));
}

export type ResolvedKnowledgeRef = { ref: string; source: string };

/**
 * Precedence:
 * 1. KNOWLEDGE_GIT_REF
 * 2. KNOWLEDGE_GIT_SHA (fetch as ref)
 * 3. On `knowledges-preview/*`: knowledges-preview.lock.json sha → lock ref → branch suffix
 * 4. knowledge.lock.json ref
 * 5. main
 */
export function resolveKnowledgeGitRef(opts: {
  repoRoot: string;
  knowledgeLock?: KnowledgeLockFile | null;
  previewLock?: KnowledgeLockFile | null;
  vercelGitRef?: string;
}): ResolvedKnowledgeRef {
  const fromRef = process.env.KNOWLEDGE_GIT_REF?.trim();
  if (fromRef) return { ref: fromRef, source: "KNOWLEDGE_GIT_REF" };

  const fromSha = process.env.KNOWLEDGE_GIT_SHA?.trim();
  if (fromSha) return { ref: fromSha, source: "KNOWLEDGE_GIT_SHA" };

  const vercelRef = opts.vercelGitRef ?? vercelGitCommitRef();
  const knowledgeLock = opts.knowledgeLock ?? readKnowledgeLock(opts.repoRoot);
  const previewLock = opts.previewLock ?? readKnowledgesPreviewLock(opts.repoRoot);

  if (isKnowledgesPreviewPodcasterBranch(vercelRef)) {
    const lockSha = previewLock?.sha?.trim();
    if (lockSha) return { ref: lockSha, source: "knowledges-preview.lock.json sha" };
    const lockRef = previewLock?.ref?.trim();
    if (lockRef) return { ref: lockRef, source: "knowledges-preview.lock.json ref" };
    const fromBranch = knowledgeRefFromPreviewBranch(vercelRef!);
    if (fromBranch) return { ref: fromBranch, source: "podcaster branch suffix" };
  }

  const fromLock = knowledgeLock?.ref?.trim();
  if (fromLock) return { ref: fromLock, source: "knowledge.lock.json ref" };

  return { ref: "main", source: "default main" };
}

/** DNS labels are limited to 63 characters (RFC 1035), which is what Vercel enforces. */
const VERCEL_MAX_DNS_LABEL_LENGTH = 63;

/**
 * Branch slug as used in `https://<project>-git-<branch-slug>-<scope>.vercel.app`.
 *
 * Vercel lowercases the branch, drops underscores and turns other characters
 * into `-` (e.g. `npm_and_yarn/foo` → `npmandyarn-foo`).
 */
export function vercelBranchUrlSlug(gitBranch: string): string {
  return gitBranch
    .toLowerCase()
    .replaceAll("_", "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Preview branch URL for a podcaster branch, including the truncation Vercel
 * applies when the label would exceed 63 characters: it keeps the project
 * prefix and the scope suffix and folds a `sha256("git-" + branch + project)`
 * hash (first 6 hex chars) into the label so truncated URLs stay unique.
 *
 * Vercel documents the layout and the limit but not the hash
 * (https://vercel.com/docs/deployments/generated-urls); the rule below was
 * verified against live deployments (see knowledge-ref.test.ts).
 */
export function vercelPreviewBranchUrl(opts: {
  projectName: string;
  scopeSlug: string;
  podcasterGitBranch: string;
}): string {
  const label = `${opts.projectName}-git-${vercelBranchUrlSlug(opts.podcasterGitBranch)}-${opts.scopeSlug}`;
  if (label.length <= VERCEL_MAX_DNS_LABEL_LENGTH) {
    return `https://${label}.vercel.app`;
  }

  const hash = createHash("sha256")
    .update(`git-${opts.podcasterGitBranch}${opts.projectName}`)
    .digest("hex")
    .slice(0, 6);
  const suffix = `${hash}-${opts.scopeSlug}`;
  const prefix = label.slice(0, VERCEL_MAX_DNS_LABEL_LENGTH - 1 - suffix.length);

  return `https://${prefix}-${suffix}.vercel.app`;
}