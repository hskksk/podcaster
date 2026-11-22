/** Client-safe. Only NEXT_PUBLIC_* (and Vercel’s public env) is inlined. */

/**
 * GitHub storage on Vercel so Keystatic can commit through the GitHub API.
 * Local `pnpm web:dev` stays on the filesystem unless explicitly set to github.
 *
 * Do not key this off NODE_ENV — `next build` is always production.
 */
export function isGithubStorage(): boolean {
  const explicit = process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE;
  if (explicit === "local") return false;
  if (explicit === "github") return true;
  return Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV);
}

/** Keystatic + GitHub storage target (private knowledge repo). */
export function keystaticGithubRepo(): string {
  return (
    process.env.KEYSTATIC_GITHUB_REPO?.trim() ||
    process.env.KNOWLEDGE_GITHUB_REPO?.trim() ||
    "hskksk/knowledges"
  );
}

/** @deprecated use keystaticGithubRepo() */
export const githubRepo = keystaticGithubRepo();
