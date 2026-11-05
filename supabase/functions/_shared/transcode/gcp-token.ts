const TOKEN_URL = "https://oauth2.googleapis.com/token";
const RUN_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function loadServiceAccount(): ServiceAccountJson {
  const raw = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON")?.trim();
  if (!raw) throw new Error("GCP_SERVICE_ACCOUNT_JSON is not set");
  return JSON.parse(raw) as ServiceAccountJson;
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function mintAccessToken(): Promise<string> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: sa.token_uri ?? TOKEN_URL,
    iat: now,
    exp: now + 3600,
    scope: RUN_SCOPE,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenUri = sa.token_uri ?? TOKEN_URL;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`GCP token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("GCP token response missing access_token");
  cachedToken = {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + (Number(json.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.accessToken;
}

export async function getGcpAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs) {
    return cachedToken.accessToken;
  }
  return mintAccessToken();
}

export async function gcpFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getGcpAccessToken();
  const url = path.startsWith("https://")
    ? path
    : `https://run.googleapis.com/v2/${path.replace(/^\//, "")}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
