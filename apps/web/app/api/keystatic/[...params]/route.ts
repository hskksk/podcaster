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
 *
 * In development, the same missing-env path is the GitHub App wizard:
 * /api/keystatic/github/login → /keystatic/setup → Create GitHub App.
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
      hint: "On your machine run `pnpm web:github`, open http://127.0.0.1:3000/keystatic/setup, create the GitHub App, then copy KEYSTATIC_GITHUB_CLIENT_ID, KEYSTATIC_GITHUB_CLIENT_SECRET, KEYSTATIC_SECRET, and NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG into the Vercel project env and redeploy.",
    },
    { status: 503 },
  );
}

function shouldServeGithubSetupWizard() {
  return isGithubStorage() && !hasGithubAppCreds();
}

export async function GET(request: NextRequest) {
  if (shouldServeGithubSetupWizard()) {
    if (process.env.NODE_ENV === "development") {
      return handlers().GET(request);
    }
    return missingGithubAppResponse();
  }
  return handlers().GET(request);
}

export async function POST(request: NextRequest) {
  if (shouldServeGithubSetupWizard()) {
    if (process.env.NODE_ENV === "development") {
      return handlers().POST(request);
    }
    return missingGithubAppResponse();
  }
  return handlers().POST(request);
}
