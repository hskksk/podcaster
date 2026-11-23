/** Client-safe. Only NEXT_PUBLIC_* (and Vercel’s public env) is inlined. */

/**
 * Capture API uses the GitHub Contents API on Vercel; local dev writes under CONTENT_ROOT.
 * Do not key this off NODE_ENV — `next build` is always production.
 */
export function isGithubStorage(): boolean {
  const explicit =
    process.env.CAPTURE_STORAGE?.trim() ||
    process.env.NEXT_PUBLIC_CONTENT_STORAGE?.trim();
  if (explicit === "local") return false;
  if (explicit === "github") return true;
  return Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV);
}

/** GitHub repo for capture API (private knowledge repo). */
export function contentGithubRepo(): string {
  return (
    process.env.CAPTURE_GITHUB_REPO?.trim() ||
    process.env.KNOWLEDGE_GITHUB_REPO?.trim() ||
    "hskksk/knowledges"
  );
}

/** @deprecated use contentGithubRepo() */
export const githubRepo = contentGithubRepo();