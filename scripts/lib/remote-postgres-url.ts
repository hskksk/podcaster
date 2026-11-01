import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type PoolerConfig = {
  db_host: string;
  db_port: number;
  db_user: string;
  db_name: string;
  pool_mode?: string;
};

function readSupabaseAccessToken(): string | null {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim();
  }
  for (const rel of [".supabase/access-token", ".config/supabase/access-token"]) {
    const path = join(homedir(), rel);
    if (!existsSync(path)) continue;
    const token = readFileSync(path, "utf8").trim();
    if (token) return token;
  }
  return null;
}

/** Session pooler (IPv4). Requires supabase login token or SUPABASE_ACCESS_TOKEN. */
export function fetchSessionPoolerDatabaseUrl(
  projectRef: string,
  password: string,
): string | null {
  const token = readSupabaseAccessToken();
  if (!token) return null;

  let body: string;
  try {
    body = execSync(
      `curl -sS -H "Authorization: Bearer ${token}" "https://api.supabase.com/v1/projects/${projectRef}/config/database/pooler"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch {
    return null;
  }

  let configs: PoolerConfig[];
  try {
    configs = JSON.parse(body) as PoolerConfig[];
  } catch {
    return null;
  }
  if (!Array.isArray(configs) || configs.length === 0) return null;

  const session =
    configs.find((c) => c.pool_mode === "session") ??
    configs.find((c) => c.db_port === 5432 && c.db_user.includes(".")) ??
    configs[0];
  if (!session?.db_host) return null;

  const user = encodeURIComponent(session.db_user);
  const pass = encodeURIComponent(password);
  const db = session.db_name || "postgres";
  return `postgresql://${user}:${pass}@${session.db_host}:${session.db_port}/${db}`;
}

export function isLocalDatabaseUrl(url: string): boolean {
  return /127\.0\.0\.1|localhost|host\.docker\.internal|:54322/.test(url);
}
