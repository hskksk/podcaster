import "server-only";

import { cookies, draftMode } from "next/headers";

export type DraftPreviewContext = {
  enabled: boolean;
  branch?: string;
  githubToken?: string;
};

/** Keystatic GitHub OAuth cookie (see middleware). */
const GH_ACCESS_TOKEN_COOKIE = "keystatic-gh-access-token";
const BRANCH_COOKIE = "ks-branch";

export async function getDraftPreviewContext(): Promise<DraftPreviewContext> {
  let enabled = false;
  try {
    enabled = (await draftMode()).isEnabled;
  } catch {
    enabled = false;
  }
  if (!enabled) return { enabled: false };

  const jar = await cookies();
  const branch = jar.get(BRANCH_COOKIE)?.value;
  const githubToken = jar.get(GH_ACCESS_TOKEN_COOKIE)?.value;
  return { enabled: true, branch, githubToken };
}
