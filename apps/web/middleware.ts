import { NextRequest, NextResponse } from "next/server";

/**
 * Optional HTTP Basic Auth for the admin UI.
 * Set KEYSTATIC_BASIC_AUTH=user:password on the host.
 * GitHub OAuth callbacks stay public so GitHub storage can complete login.
 */
export function middleware(req: NextRequest) {
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
  matcher: ["/keystatic", "/keystatic/:path*", "/api/keystatic/:path*"],
};
