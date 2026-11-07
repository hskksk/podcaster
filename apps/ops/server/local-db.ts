import { execSync } from "node:child_process";
import postgres from "postgres";
import { HttpError } from "./http-error.ts";

type LocalStatus = {
  apiUrl: string;
  serviceKey: string;
  dbUrl: string;
};

let cached: { at: number; status: LocalStatus } | undefined;
let sql: postgres.Sql | undefined;
let sqlUrl: string | undefined;

function readStatus(): LocalStatus {
  const now = Date.now();
  if (cached && now - cached.at < 5000) return cached.status;
  let out: string;
  try {
    out = execSync("supabase status -o json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    throw new HttpError(503, "Local Supabase is not running. Start it with supabase start.");
  }
  const parsed = JSON.parse(out) as {
    API_URL?: string;
    SERVICE_ROLE_KEY?: string;
    DB_URL?: string;
  };
  if (!parsed.API_URL || !parsed.SERVICE_ROLE_KEY || !parsed.DB_URL) {
    throw new HttpError(503, "supabase status did not include API_URL, SERVICE_ROLE_KEY, and DB_URL.");
  }
  const status = {
    apiUrl: parsed.API_URL,
    serviceKey: parsed.SERVICE_ROLE_KEY,
    dbUrl: parsed.DB_URL,
  };
  cached = { at: now, status };
  return status;
}

/** Local stack only. Ignores DATABASE_URL so a remote URL in the shell cannot be used. */
export function sqlClient(): postgres.Sql {
  const status = readStatus();
  if (!sql || sqlUrl !== status.dbUrl) {
    void sql?.end({ timeout: 1 });
    sqlUrl = status.dbUrl;
    sql = postgres(status.dbUrl, { max: 4, idle_timeout: 20, connect_timeout: 5 });
  }
  return sql;
}

export function localApi(): { apiUrl: string; serviceKey: string } {
  const status = readStatus();
  return { apiUrl: status.apiUrl, serviceKey: status.serviceKey };
}
