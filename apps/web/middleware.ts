import { NextRequest, NextResponse } from "next/server";
import { githubRepo } from "./lib/storage";

const GH_ACCESS_TOKEN_COOKIE = "keystatic-gh-access-token";
const WEB_CLIPS_RETURN_COOKIE = "web-clips-return-to";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname === "/web-clips" || pathname.startsWith("/web-clips/")) {
    return webClipsGate(req);
  }

  const response = keystaticBasicAuth(req);
  if (response.status !== 200) return response;

  if (pathname === "/keystatic" || pathname.startsWith("/keystatic/")) {
    return (await returnToRequestedWebClips(req)) ?? response;
  }

  return response;
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
  const owner = githubRepo.split("/")[0];
  if (token && (await isRepoOwner(token, owner))) {
    const response = NextResponse.next();
    response.cookies.delete(WEB_CLIPS_RETURN_COOKIE);
    return response;
  }

  const response = NextResponse.redirect(new URL("/keystatic", req.url));
  // Return to the requested clip after the Keystatic OAuth callback.
  response.cookies.set(WEB_CLIPS_RETURN_COOKIE, req.nextUrl.pathname + req.nextUrl.search, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}

async function returnToRequestedWebClips(req: NextRequest): Promise<NextResponse | null> {
  const returnTo = req.cookies.get(WEB_CLIPS_RETURN_COOKIE)?.value;
  const token = req.cookies.get(GH_ACCESS_TOKEN_COOKIE)?.value;
  if (!returnTo || !token) return null;

  let target: URL;
  try {
    target = new URL(returnTo, req.url);
  } catch {
    return null;
  }

  if (
    target.origin !== req.nextUrl.origin ||
    (target.pathname !== "/web-clips" && !target.pathname.startsWith("/web-clips/"))
  ) {
    return null;
  }

  const owner = githubRepo.split("/")[0];
  if (!(await isRepoOwner(token, owner))) return null;

  const response = NextResponse.redirect(target);
  response.cookies.delete(WEB_CLIPS_RETURN_COOKIE);
  return response;
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
