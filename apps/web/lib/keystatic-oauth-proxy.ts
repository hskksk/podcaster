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

async function encryptJson(payload: ProxyOAuthState, secret: string): Promise<string> {
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

async function decryptJson(encrypted: string, secret: string): Promise<ProxyOAuthState | null> {
  try {
    const decoded = base64UrlDecode(encrypted);
    const salt = decoded.slice(0, SALT_LENGTH);
    const key = await deriveKey(secret, salt);
    const iv = decoded.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const value = decoded.slice(SALT_LENGTH + IV_LENGTH);
    const decrypted = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv }, key, value);
    const parsed = JSON.parse(decoder.decode(decrypted)) as ProxyOAuthState;
    if (parsed?.v !== 1 || typeof parsed.origin !== "string" || typeof parsed.from !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Stable production callback URL registered in the GitHub App. */
export function oauthProxyCallbackUrl(): string | null {
  const explicit = process.env.KEYSTATIC_OAUTH_PROXY_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_MAIN_URL?.trim();
  if (!site) return null;
  return `${site.replace(/\/$/, "")}${KEYSTATIC_GITHUB_OAUTH_CALLBACK_PATH}`;
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

export function isVercelPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function isOnOAuthProxyHost(request: Request): boolean {
  const proxy = oauthProxyCallbackUrl();
  if (!proxy) return false;
  return requestOrigin(request) === new URL(proxy).origin;
}

/** Preview deployments use the stable production callback as redirect_uri. */
export function shouldProxyGithubLogin(request: Request): boolean {
  return isVercelPreviewDeployment() && oauthProxyEnabled() && !isOnOAuthProxyHost(request);
}

/**
 * Rewrite internal host (localhost) to the public host Vercel forwards.
 * Keystatic builds redirect_uri from request.url; without this, OAuth breaks on serverless.
 */
export function rewriteRequestForPublicOrigin(request: Request): Request {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (!forwardedHost || !forwardedProto) return request;

  const url = new URL(request.url);
  url.hostname = forwardedHost.split(",")[0]?.trim() ?? forwardedHost;
  url.protocol = forwardedProto.includes(":") ? forwardedProto : `${forwardedProto}:`;
  url.port = "";
  return new Request(url.toString(), request);
}

function parseKeystaticFrom(request: Request): string {
  const reqUrl = new URL(request.url);
  const rawFrom = reqUrl.searchParams.get("from");
  return typeof rawFrom === "string" && keystaticRouteRegex.test(rawFrom) ? rawFrom : "/";
}

function redirectResponse(location: string, extraHeaders?: [string, string][]): Response {
  return new Response(null, {
    status: 307,
    headers: [...(extraHeaders ?? []), ["Location", location]],
  });
}

/** Initiate GitHub OAuth from a Preview deployment via the production callback URL. */
export async function handleProxyGithubLogin(request: Request): Promise<Response> {
  const secret = process.env.KEYSTATIC_SECRET!;
  const clientId = process.env.KEYSTATIC_GITHUB_CLIENT_ID!;
  const proxyCallback = oauthProxyCallbackUrl()!;
  const publicReq = rewriteRequestForPublicOrigin(request);
  const from = parseKeystaticFrom(publicReq);
  const origin = requestOrigin(publicReq);

  const state = await encryptJson({ v: 1, origin, from }, secret);
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
export async function handleProxyOAuthCallback(request: Request): Promise<Response | null> {
  if (!isOnOAuthProxyHost(request)) return null;

  const secret = process.env.KEYSTATIC_SECRET!;
  const searchParams = new URL(request.url).searchParams;
  const stateParam = searchParams.get("state");
  if (!stateParam) return null;

  const parsed = await decryptJson(stateParam, secret);
  if (!parsed) return null;

  const proxyOrigin = requestOrigin(request);
  if (parsed.origin === proxyOrigin) return null;

  const code = searchParams.get("code");
  if (!code) return null;

  const returnUrl = new URL(PROXY_RETURN_PATH, parsed.origin);
  returnUrl.searchParams.set("code", code);
  returnUrl.searchParams.set("state", stateParam);
  const error = searchParams.get("error");
  if (error) returnUrl.searchParams.set("error", error);
  const errorDescription = searchParams.get("error_description");
  if (errorDescription) returnUrl.searchParams.set("error_description", errorDescription);

  return redirectResponse(returnUrl.toString());
}

const tokenDataSchema = {
  parse(data: unknown): {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    refresh_token_expires_in: number;
  } | null {
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    if (
      typeof d.access_token !== "string" ||
      typeof d.expires_in !== "number" ||
      typeof d.refresh_token !== "string" ||
      typeof d.refresh_token_expires_in !== "number"
    ) {
      return null;
    }
    return {
      access_token: d.access_token,
      expires_in: d.expires_in,
      refresh_token: d.refresh_token,
      refresh_token_expires_in: d.refresh_token_expires_in,
    };
  },
};

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

async function tokenCookieHeaders(
  tokenData: NonNullable<ReturnType<typeof tokenDataSchema.parse>>,
  secret: string,
): Promise<[string, string][]> {
  const secure = process.env.NODE_ENV === "production";
  return [
    [
      "Set-Cookie",
      cookie.serialize("keystatic-gh-access-token", tokenData.access_token, {
        sameSite: "lax",
        secure,
        maxAge: tokenData.expires_in,
        expires: new Date(Date.now() + tokenData.expires_in * 1000),
        path: "/",
      }),
    ],
    [
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
    ],
  ];
}

/** Preview-only: exchange the code and set Keystatic session cookies locally. */
export async function handleProxyOAuthReturn(request: Request): Promise<Response> {
  const secret = process.env.KEYSTATIC_SECRET!;
  const clientId = process.env.KEYSTATIC_GITHUB_CLIENT_ID!;
  const clientSecret = process.env.KEYSTATIC_GITHUB_CLIENT_SECRET!;

  const searchParams = new URL(request.url).searchParams;
  const errorDescription = searchParams.get("error_description");
  if (typeof errorDescription === "string") {
    return new Response(`GitHub OAuth error:\n${errorDescription}`, { status: 400 });
  }

  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  if (typeof code !== "string" || typeof stateParam !== "string") {
    return new Response("Bad Request", { status: 400 });
  }

  const parsed = await decryptJson(stateParam, secret);
  if (!parsed || parsed.origin !== requestOrigin(rewriteRequestForPublicOrigin(request))) {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  const tokenUrl = new URL("https://github.com/login/oauth/access_token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!tokenRes.ok) {
    return new Response("Authorization failed", { status: 401 });
  }

  const tokenData = tokenDataSchema.parse(await tokenRes.json());
  if (!tokenData) {
    return new Response("Authorization failed", { status: 401 });
  }

  const headers = await tokenCookieHeaders(tokenData, secret);

  const fromPath = parsed.from === "/" ? "" : `/${parsed.from}`;
  return redirectResponse(`/keystatic${fromPath}`, headers);
}

export function keystaticGithubRouteSuffix(pathname: string): string {
  return pathname
    .replace(/^\/api\/keystatic\/?/, "")
    .split("/")
    .map((x) => decodeURIComponent(x))
    .filter(Boolean)
    .join("/");
}
