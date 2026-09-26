import "server-only";

import { webcrypto } from "node:crypto";
import cookie from "cookie";

/** Same path Keystatic uses for GitHub OAuth completion. */
export const KEYSTATIC_GITHUB_OAUTH_CALLBACK_PATH = "/api/keystatic/github/oauth/callback";

const PROXY_RETURN_PATH = "/api/keystatic/github/oauth/proxy-return";

const keystaticRouteRegex =
  /^branch\/[^]+(\/collection\/[^/]+(|\/(create|item\/[^/]+))|\/singleton\/[^/]+)?$/;

type ProxyOAuthState = {
  v: 1;
  origin: string;
  from: string;
};

type GithubTokenData = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
};

/** Handoff blob: token exchange runs on the stable host, Preview only sets cookies. */
type ProxyOAuthSession = {
  v: 1;
  kind: "session";
  origin: string;
  from: string;
  token: GithubTokenData;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function base64UrlEncode(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(base64: string): Uint8Array {
  const binString = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  if (secret.length < 32) {
    throw new Error("KEYSTATIC_SECRET must be at least 32 characters long");
  }
  const key = await webcrypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, [
    "deriveKey",
  ]);
  return webcrypto.subtle.deriveKey(
    {
      name: "HKDF",
      salt,
      hash: "SHA-256",
      info: new Uint8Array(0),
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPayload(payload: unknown, secret: string): Promise<string> {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(secret, salt);
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  const full = new Uint8Array(SALT_LENGTH + IV_LENGTH + encrypted.byteLength);
  full.set(salt);
  full.set(iv, SALT_LENGTH);
  full.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);
  return base64UrlEncode(full);
}

async function decryptPayload(encrypted: string, secret: string): Promise<unknown | null> {
  try {
    const decoded = base64UrlDecode(encrypted);
    const salt = decoded.slice(0, SALT_LENGTH);
    const key = await deriveKey(secret, salt);
    const iv = decoded.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const value = decoded.slice(SALT_LENGTH + IV_LENGTH);
    const decrypted = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv }, key, value);
    return JSON.parse(decoder.decode(decrypted)) as unknown;
  } catch {
    return null;
  }
}

function parseProxyOAuthState(raw: unknown): ProxyOAuthState | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as ProxyOAuthState;
  if (parsed.v !== 1 || typeof parsed.origin !== "string" || typeof parsed.from !== "string") {
    return null;
  }
  if ("kind" in parsed) return null;
  return parsed;
}

function parseProxyOAuthSession(raw: unknown): ProxyOAuthSession | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as ProxyOAuthSession;
  if (
    parsed.v !== 1 ||
    parsed.kind !== "session" ||
    typeof parsed.origin !== "string" ||
    typeof parsed.from !== "string"
  ) {
    return null;
  }
  const token = parseGithubTokenData(parsed.token);
  if (!token) return null;
  return { ...parsed, token };
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseGithubTokenData(raw: unknown): GithubTokenData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const access_token = typeof d.access_token === "string" ? d.access_token : null;
  const refresh_token = typeof d.refresh_token === "string" ? d.refresh_token : null;
  const expires_in = parseNumber(d.expires_in);
  const refresh_token_expires_in =
    parseNumber(d.refresh_token_expires_in) ?? 15_552_000; /* ~180 days if omitted */
  if (!access_token || !refresh_token || expires_in === null) return null;
  return { access_token, refresh_token, expires_in, refresh_token_expires_in };
}

/** Public site origin used as the GitHub OAuth callback host (Preview でも Production 値). */
export function stableSiteBaseUrl(): string | null {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_MAIN_URL?.trim();
  if (site) return site.replace(/\/$/, "");

  const vercelProd =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    const host = vercelProd.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return null;
}

/** Stable production callback URL registered in the GitHub App. */
export function oauthProxyCallbackUrl(): string | null {
  const explicit = process.env.KEYSTATIC_OAUTH_PROXY_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const base = stableSiteBaseUrl();
  if (!base) return null;
  return `${base}${KEYSTATIC_GITHUB_OAUTH_CALLBACK_PATH}`;
}

export function oauthProxyEnabled(): boolean {
  return oauthProxyCallbackUrl() !== null && hasProxySecrets();
}

function hasProxySecrets(): boolean {
  return Boolean(
    process.env.KEYSTATIC_GITHUB_CLIENT_ID &&
      process.env.KEYSTATIC_GITHUB_CLIENT_SECRET &&
      process.env.KEYSTATIC_SECRET,
  );
}

function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

/** Canonical origin for OAuth state (protocol + host, lowercase). */
export function normalizeOrigin(origin: string): string | null {
  try {
    const u = new URL(origin);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.port ? `:${u.port}` : ""}`;
  } catch {
    return null;
  }
}

export function originsMatch(expected: string, actual: string): boolean {
  const a = normalizeOrigin(expected);
  const b = normalizeOrigin(actual);
  return a !== null && b !== null && a === b;
}

export function publicRequestOrigin(request: Request): string {
  return requestOrigin(rewriteRequestForPublicOrigin(request));
}

export function stableSiteOrigin(): string | null {
  const callback = oauthProxyCallbackUrl();
  if (!callback) return null;
  try {
    return new URL(callback).origin;
  } catch {
    return null;
  }
}

export function isOnOAuthProxyHost(request: Request): boolean {
  const stable = stableSiteOrigin();
  if (!stable) return false;
  return publicRequestOrigin(request) === stable;
}

/**
 * Use the stable callback whenever the browser host ≠ GitHub 登録ドメイン
 * (Preview URL, デプロイ固有 URL, 未登録の alias など).
 */
export function shouldProxyGithubLogin(request: Request): boolean {
  if (!oauthProxyEnabled()) return false;
  const stable = stableSiteOrigin();
  if (!stable) return false;
  return publicRequestOrigin(request) !== stable;
}

/**
 * Rewrite internal host (localhost) to the public host Vercel forwards.
 * Keystatic builds redirect_uri from request.url; without this, OAuth breaks on serverless.
 */
export function rewriteRequestForPublicOrigin(request: Request): Request {
  const forwardedHost =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("x-vercel-forwarded-host") ??
    request.headers.get("host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ??
    (forwardedHost?.includes("localhost") || forwardedHost?.startsWith("127.0.0.1")
      ? "http"
      : "https");
  if (!forwardedHost) return request;

  const url = new URL(request.url);
  const host = forwardedHost.split(",")[0]?.trim() ?? forwardedHost;
  url.host = host;
  url.protocol = forwardedProto.includes(":") ? forwardedProto : `${forwardedProto}:`;
  return new Request(url.toString(), request);
}

function parseKeystaticFrom(request: Request): string {
  const reqUrl = new URL(request.url);
  const rawFrom = reqUrl.searchParams.get("from");
  return typeof rawFrom === "string" && keystaticRouteRegex.test(rawFrom) ? rawFrom : "/";
}

function redirectResponse(location: string, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Location", location);
  return new Response(null, { status: 307, headers });
}

function plainErrorResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Initiate GitHub OAuth from a Preview deployment via the production callback URL. */
export async function handleProxyGithubLogin(request: Request): Promise<Response> {
  const secret = process.env.KEYSTATIC_SECRET!;
  const clientId = process.env.KEYSTATIC_GITHUB_CLIENT_ID!;
  const proxyCallback = oauthProxyCallbackUrl()!;
  const publicReq = rewriteRequestForPublicOrigin(request);
  const from = parseKeystaticFrom(publicReq);
  const origin = normalizeOrigin(requestOrigin(publicReq)) ?? requestOrigin(publicReq);

  const state = await encryptPayload({ v: 1, origin, from }, secret);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", proxyCallback);
  url.searchParams.set("state", state);
  return redirectResponse(url.toString());
}

/**
 * On the stable deployment: forward GitHub's callback to the Preview URL that
 * started the flow (Auth.js redirectProxyUrl pattern).
 */
async function exchangeGithubAuthorizationCode(
  code: string,
): Promise<{ ok: true; token: GithubTokenData } | { ok: false; message: string }> {
  const clientId = process.env.KEYSTATIC_GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.KEYSTATIC_GITHUB_CLIENT_SECRET?.trim();
  const redirectUri = oauthProxyCallbackUrl();
  if (!clientId || !clientSecret || !redirectUri) {
    return { ok: false, message: "GitHub OAuth is not configured on this deployment." };
  }

  const tokenUrl = new URL("https://github.com/login/oauth/access_token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);

  let tokenRes: Response;
  try {
    tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `GitHub token request failed: ${msg}` };
  }

  let body: unknown;
  try {
    body = await tokenRes.json();
  } catch {
    return { ok: false, message: "GitHub token response was not JSON." };
  }

  if (!tokenRes.ok) {
    return {
      ok: false,
      message: `GitHub token HTTP ${tokenRes.status}: ${JSON.stringify(body)}`,
    };
  }

  if (body && typeof body === "object" && "error" in body) {
    const rec = body as Record<string, unknown>;
    const desc = typeof rec.error_description === "string" ? rec.error_description : "";
    return {
      ok: false,
      message: `GitHub OAuth error: ${String(rec.error)}${desc ? `\n${desc}` : ""}`,
    };
  }

  const token = parseGithubTokenData(body);
  if (!token) {
    return { ok: false, message: `Unexpected GitHub token response: ${JSON.stringify(body)}` };
  }
  return { ok: true, token };
}

export async function handleProxyOAuthCallback(request: Request): Promise<Response | null> {
  if (!isOnOAuthProxyHost(request)) return null;

  const secret = process.env.KEYSTATIC_SECRET?.trim();
  if (!secret) return plainErrorResponse("KEYSTATIC_SECRET is not set.", 503);

  const searchParams = new URL(request.url).searchParams;
  const stateParam = searchParams.get("state");
  if (!stateParam) return null;

  const parsed = parseProxyOAuthState(await decryptPayload(stateParam, secret));
  if (!parsed) return null;

  if (originsMatch(parsed.origin, publicRequestOrigin(request))) return null;

  const errorDescription = searchParams.get("error_description");
  if (typeof errorDescription === "string") {
    const returnUrl = new URL(PROXY_RETURN_PATH, parsed.origin);
    returnUrl.searchParams.set("error_description", errorDescription);
    return redirectResponse(returnUrl.toString());
  }

  const code = searchParams.get("code");
  if (!code) return plainErrorResponse("Missing OAuth code.", 400);

  // Forward code to Preview (short URL). Token exchange runs on Preview with redirect_uri.
  const returnUrl = new URL(PROXY_RETURN_PATH, parsed.origin);
  returnUrl.searchParams.set("code", code);
  returnUrl.searchParams.set("state", stateParam);
  return redirectResponse(returnUrl.toString());
}

async function encryptValue(value: string, secret: string): Promise<string> {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(secret, salt);
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value),
  );
  const full = new Uint8Array(SALT_LENGTH + IV_LENGTH + encrypted.byteLength);
  full.set(salt);
  full.set(iv, SALT_LENGTH);
  full.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);
  return base64UrlEncode(full);
}

async function applyTokenCookies(tokenData: GithubTokenData, secret: string): Promise<Headers> {
  const secure = process.env.NODE_ENV === "production";
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    cookie.serialize("keystatic-gh-access-token", tokenData.access_token, {
      sameSite: "lax",
      secure,
      maxAge: tokenData.expires_in,
      expires: new Date(Date.now() + tokenData.expires_in * 1000),
      path: "/",
    }),
  );
  headers.append(
    "Set-Cookie",
    cookie.serialize(
      "keystatic-gh-refresh-token",
      await encryptValue(tokenData.refresh_token, secret),
      {
        sameSite: "lax",
        secure,
        httpOnly: true,
        maxAge: tokenData.refresh_token_expires_in,
        expires: new Date(Date.now() + tokenData.refresh_token_expires_in * 100),
        path: "/",
      },
    ),
  );
  return headers;
}

async function resolveProxyReturnContext(
  request: Request,
  secret: string,
): Promise<
  | { ok: true; from: string; token: GithubTokenData }
  | { ok: false; status: number; message: string }
> {
  const searchParams = new URL(request.url).searchParams;
  const here = publicRequestOrigin(request);

  const sessionParam = searchParams.get("session");
  if (typeof sessionParam === "string") {
    const raw = await decryptPayload(sessionParam, secret);
    if (!raw) {
      return {
        ok: false,
        status: 400,
        message:
          "Could not decrypt OAuth session (check KEYSTATIC_SECRET matches Production).\n",
      };
    }
    const session = parseProxyOAuthSession(raw);
    if (!session) {
      return { ok: false, status: 400, message: "OAuth session payload was invalid.\n" };
    }
    if (!originsMatch(session.origin, here)) {
      return {
        ok: false,
        status: 400,
        message: `OAuth session origin mismatch.\nexpected: ${session.origin}\nactual:   ${here}\n`,
      };
    }
    return { ok: true, from: session.from, token: session.token };
  }

  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  if (typeof code !== "string" || typeof stateParam !== "string") {
    return {
      ok: false,
      status: 400,
      message:
        "Missing OAuth parameters (need session= or code= and state=).\n" +
        "If Production and Preview are on different commits, redeploy both from the same PR.\n",
    };
  }

  const rawState = await decryptPayload(stateParam, secret);
  if (!rawState) {
    return {
      ok: false,
      status: 400,
      message:
        "Could not decrypt OAuth state (check KEYSTATIC_SECRET matches Production).\n",
    };
  }
  const state = parseProxyOAuthState(rawState);
  if (!state) {
    return { ok: false, status: 400, message: "OAuth state payload was invalid.\n" };
  }
  if (!originsMatch(state.origin, here)) {
    return {
      ok: false,
      status: 400,
      message: `OAuth state origin mismatch.\nexpected: ${state.origin}\nactual:   ${here}\n`,
    };
  }

  const exchanged = await exchangeGithubAuthorizationCode(code);
  if (!exchanged.ok) {
    return { ok: false, status: 502, message: exchanged.message };
  }
  return { ok: true, from: state.from, token: exchanged.token };
}

/** Preview: complete OAuth and set Keystatic session cookies locally. */
export async function handleProxyOAuthReturn(request: Request): Promise<Response> {
  try {
    const secret = process.env.KEYSTATIC_SECRET?.trim();
    if (!secret) return plainErrorResponse("KEYSTATIC_SECRET is not set.", 503);

    const searchParams = new URL(request.url).searchParams;
    const errorDescription = searchParams.get("error_description");
    if (typeof errorDescription === "string") {
      return plainErrorResponse(`GitHub OAuth error:\n${errorDescription}`, 400);
    }

    const ctx = await resolveProxyReturnContext(request, secret);
    if (!ctx.ok) {
      return plainErrorResponse(ctx.message, ctx.status);
    }

    const headers = await applyTokenCookies(ctx.token, secret);
    const fromPath = ctx.from === "/" ? "" : `/${ctx.from}`;
    return redirectResponse(`/keystatic${fromPath}`, headers);
  } catch (err) {
    console.error("proxy-return failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return plainErrorResponse(`OAuth proxy-return failed: ${msg}`, 500);
  }
}

export function keystaticGithubRouteSuffix(pathname: string): string {
  return pathname
    .replace(/^\/api\/keystatic\/?/, "")
    .split("/")
    .map((x) => decodeURIComponent(x))
    .filter(Boolean)
    .join("/");
}
