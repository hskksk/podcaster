/** Client-safe. Only NEXT_PUBLIC_* is inlined into the browser bundle. */
export function isGithubStorage(): boolean {
  return process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE === "github";
}

export const githubRepo = "hskksk/podcaster" as const;
