import { decodeProtectedHeader, createRemoteJWKSet, jwtVerify, type JWTPayload } from "npm:jose@5";

const remoteJwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export type VerifyGeminiWebhookJwtInput = {
  token: string;
  jwksUrl: string;
  audience: string;
  issuers?: string[];
};

function getRemoteJwks(jwksUrl: string): ReturnType<typeof createRemoteJWKSet> {
  const normalized = jwksUrl.trim();
  const cached = remoteJwksCache.get(normalized);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(normalized));
  remoteJwksCache.set(normalized, jwks);
  return jwks;
}

function assertRequiredNumericClaim(payload: JWTPayload, key: "exp" | "nbf"): void {
  if (typeof payload[key] !== "number") {
    throw new Error(`Webhook JWT is missing required '${key}' claim`);
  }
}

export async function verifyGeminiWebhookJwt(input: VerifyGeminiWebhookJwtInput): Promise<JWTPayload> {
  const token = input.token.trim();
  if (!token) throw new Error("Webhook JWT token is empty");
  if (!input.jwksUrl.trim()) throw new Error("JWKS URL is empty");
  if (!input.audience.trim()) throw new Error("Audience is empty");

  const protectedHeader = decodeProtectedHeader(token);
  if (protectedHeader.alg !== "RS256") {
    throw new Error(`Unsupported webhook JWT alg: ${String(protectedHeader.alg)}`);
  }
  if (typeof protectedHeader.kid !== "string" || protectedHeader.kid.length === 0) {
    throw new Error("Webhook JWT is missing kid");
  }

  const allowedIssuers = input.issuers?.length
    ? input.issuers
    : ["https://accounts.google.com", "accounts.google.com"];

  const { payload } = await jwtVerify(token, getRemoteJwks(input.jwksUrl), {
    algorithms: ["RS256"],
    audience: input.audience,
    issuer: allowedIssuers,
  });

  assertRequiredNumericClaim(payload, "exp");
  assertRequiredNumericClaim(payload, "nbf");
  return payload;
}
