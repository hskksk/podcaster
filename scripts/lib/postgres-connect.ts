import { execSync } from "node:child_process";
import postgres from "postgres";

const DEFAULT_LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const target = process.env.TARGET ?? "remote";
  if (target !== "local") {
    console.error(
      "DATABASE_URL が未設定です。リモートでは接続文字列を DATABASE_URL に設定してください。",
    );
    process.exit(1);
  }

  try {
    const out = execSync("supabase status -o json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const status = JSON.parse(out) as { DB_URL?: string };
    if (status.DB_URL) return status.DB_URL;
  } catch {
    // fall through
  }

  return DEFAULT_LOCAL_URL;
}

export function connectPostgres(): postgres.Sql {
  const url = resolveDatabaseUrl();
  return postgres(url, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}
