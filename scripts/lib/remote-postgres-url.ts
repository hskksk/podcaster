import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

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

function readLinkedProjectRef(): string | null {
  const path = resolve(process.cwd(), "supabase/.temp/project-ref");
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8").trim() || null;
}

function applyPoolerUrlPassword(template: string, password: string): string | null {
  const trimmed = template.trim();
  if (!trimmed) return null;
  const pass = encodeURIComponent(password);

  if (trimmed.includes("[YOUR-PASSWORD]")) {
    return trimmed.replaceAll("[YOUR-PASSWORD]", pass);
  }

  // Already contains user:password@
  if (/^postgres(?:ql)?:\/\/[^:@/]+:[^@]+@/i.test(trimmed)) {
    return trimmed;
  }

  // Newer CLI: postgresql://postgres.<ref>@pooler.host:5432/postgres (no password segment)
  const inject = trimmed.match(/^(postgres(?:ql)?:\/\/)([^@/]+)@(.+)$/i);
  if (inject) {
    return `${inject[1]}${inject[2]}:${pass}@${inject[3]}`;
  }

  return null;
}

/** Written by `supabase link`. Works when PAT is only in Keychain. */
export function poolerDatabaseUrlFromLinkedProject(
  projectRef: string,
  password: string,
): string | null {
  const linkedRef = readLinkedProjectRef();
  if (linkedRef && linkedRef !== projectRef) return null;

  const poolerPath = resolve(process.cwd(), "supabase/.temp/pooler-url");
  if (!existsSync(poolerPath)) return null;

  const template = readFileSync(poolerPath, "utf8");
  return applyPoolerUrlPassword(template, password);
}

function fetchPoolerConfigsViaApi(projectRef: string, token: string): PoolerConfig[] | null {
  const script = `
    fetch("https://api.supabase.com/v1/projects/${projectRef}/config/database/pooler", {
      headers: { Authorization: "Bearer " + process.env.SB_TOKEN },
    })
      .then(async (res) => {
        if (!res.ok) process.exit(2);
        process.stdout.write(await res.text());
      })
      .catch(() => process.exit(1));
  `;
  const res = spawnSync(process.execPath, ["-e", script], {
    env: { ...process.env, SB_TOKEN: token },
    encoding: "utf8",
  });
  if (res.status !== 0 || !res.stdout?.trim()) return null;
  try {
    const parsed = JSON.parse(res.stdout) as PoolerConfig[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildUrlFromPoolerConfig(config: PoolerConfig, password: string): string | null {
  if (!config.db_host) return null;
  const user = encodeURIComponent(config.db_user);
  const pass = encodeURIComponent(password);
  const db = config.db_name || "postgres";
  return `postgresql://${user}:${pass}@${config.db_host}:${config.db_port}/${db}`;
}

/** Session pooler (IPv4). Prefer linked pooler-url, then Management API token. */
export function fetchSessionPoolerDatabaseUrl(
  projectRef: string,
  password: string,
): string | null {
  const fromLink = poolerDatabaseUrlFromLinkedProject(projectRef, password);
  if (fromLink) return fromLink;

  const token = readSupabaseAccessToken();
  if (!token) return null;

  const configs = fetchPoolerConfigsViaApi(projectRef, token);
  if (!configs?.length) return null;

  const session =
    configs.find((c) => c.pool_mode === "session") ??
    configs.find((c) => c.db_port === 5432 && c.db_user.includes(".")) ??
    configs[0];
  return buildUrlFromPoolerConfig(session, password);
}

export function isLocalDatabaseUrl(url: string): boolean {
  return /127\.0\.0\.1|localhost|host\.docker\.internal|:54322/.test(url);
}
