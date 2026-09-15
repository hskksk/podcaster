import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time Bearer comparison.
 * Hashes both sides so length differences do not short-circuit.
 */
export function captureTokenOk(header: string | null, token: string): boolean {
  if (!token) return false;
  if (!header?.startsWith("Bearer ")) return false;
  const got = header.slice("Bearer ".length).trim();
  if (!got) return false;
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}

export function captureTokenFromEnv(): string {
  return process.env.CAPTURE_API_TOKEN?.trim() ?? "";
}
