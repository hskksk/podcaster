import { makeRouteHandler } from "@keystatic/next/route-handler";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import config from "../../../../keystatic.config";
import { hasGithubAppCreds } from "../../../../lib/github-app";
import { getRepoRoot } from "../../../../lib/repo-root";
import { isGithubStorage } from "../../../../lib/storage";

export const runtime = "nodejs";

/**
 * Lazy so `next build` on Vercel does not throw when GitHub App env is
 * missing. Keystatic's github handler refuses to construct in production
 * without KEYSTATIC_GITHUB_* .
 */
function handlers() {
  return makeRouteHandler({
    config,
    ...(isGithubStorage() ? {} : { localBaseDirectory: getRepoRoot() }),
  });
}

function missingGithubAppResponse() {
  return NextResponse.json(
    {
      error: "Keystatic GitHub App is not configured",
      hint: "On your machine run `pnpm web:github`, create the GitHub App at /keystatic, then copy KEYSTATIC_GITHUB_CLIENT_ID, KEYSTATIC_GITHUB_CLIENT_SECRET, KEYSTATIC_SECRET, and NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG into the Vercel project env and redeploy.",
    },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  if (isGithubStorage() && !hasGithubAppCreds()) {
    return missingGithubAppResponse();
  }
  return handlers().GET(request);
}

export async function POST(request: NextRequest) {
  if (isGithubStorage() && !hasGithubAppCreds()) {
    return missingGithubAppResponse();
  }
  return handlers().POST(request);
}
