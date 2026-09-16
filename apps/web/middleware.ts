import { NextRequest, NextResponse } from "next/server";
import { githubRepo } from "./lib/storage";

const GH_ACCESS_TOKEN_COOKIE = "keystatic-gh-access-token";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname === "/web-clips" || pathname.startsWith("/web-clips/")) {
    return webClipsGate(req);
  }

  return keystaticBasicAuth(req);
}

/**
 * Gate /web-clips behind the same GitHub OAuth login Keystatic uses
 * (`keystatic-gh-access-token`, set by @keystatic/core's GitHub storage
 * flow). Only the repo owner's GitHub account is let through, since that's
 * who Keystatic itself trusts to write content.
 *
 * Skipped entirely when this deployment has no GitHub App configured
 * (local dev without KEYSTATIC_GITHUB_CLIENT_ID), matching how local
 * checkouts already have unrestricted filesystem access to content/.
 */
async function webClipsGate(req: NextRequest): Promise<NextResponse> {
  const hasGithubAppCreds =
    process.env.KEYSTATIC_GITHUB_CLIENT_ID &&
    process.env.KEYSTATIC_GITHUB_CLIENT_SECRET &&
    process.env.KEYSTATIC_SECRET;
  if (!hasGithubAppCreds) return NextResponse.next();

  const token = req.cookies.get(GH_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL("/keystatic", req.url));

  const owner = githubRepo.split("/")[0];
  if (!(await isRepoOwner(token, owner))) {
    return NextResponse.redirect(new URL("/keystatic", req.url));
  }

  return NextResponse.next();
}

async function isRepoOwner(token: string, owner: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "podcaster-web-clips-gate",
      },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const user = (await res.json()) as { login?: unknown };
    return typeof user.login === "string" && user.login.toLowerCase() === owner.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Optional HTTP Basic Auth for the admin UI.
 * Set KEYSTATIC_BASIC_AUTH=user:password on the host.
 * GitHub OAuth callbacks stay public so GitHub storage can complete login.
 */
function keystaticBasicAuth(req: NextRequest) {
  const raw = process.env.KEYSTATIC_BASIC_AUTH;
  if (!raw) return NextResponse.next();

  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/api/keystatic/github/")) {
    return NextResponse.next();
  }

  const colon = raw.indexOf(":");
  if (colon <= 0) return NextResponse.next();
  const user = raw.slice(0, colon);
  const pass = raw.slice(colon + 1);

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      if (decoded === `${user}:${pass}`) return NextResponse.next();
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Keystatic"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: [
    "/keystatic",
    "/keystatic/:path*",
    "/api/keystatic/:path*",
    "/web-clips",
    "/web-clips/:path*",
  ],
};
