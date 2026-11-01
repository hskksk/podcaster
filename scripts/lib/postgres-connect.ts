import { execSync } from "node:child_process";
import postgres from "postgres";
import {
  fetchSessionPoolerDatabaseUrl,
  isLocalDatabaseUrl,
} from "./remote-postgres-url.ts";
import { buildRemoteDirectDatabaseUrl, detectProjectRef } from "./supabase-detect.ts";

const DEFAULT_LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const target = process.env.TARGET ?? "remote";
  if (target !== "local") {
    const password = process.env.SUPABASE_DB_PASSWORD;
    if (password) {
      const ref = detectProjectRef();
      const poolerUrl = fetchSessionPoolerDatabaseUrl(ref, password);
      if (poolerUrl) {
        console.log(
          `Using session pooler for project ${ref} (SUPABASE_DB_PASSWORD + Management API).`,
        );
        return poolerUrl;
      }
      console.log(
        `Using direct Postgres for project ${ref} (SUPABASE_DB_PASSWORD + CLI ref, SSL). ` +
          "Pooler auto-detect failed — set DATABASE_URL from Dashboard Connect (Session pooler) if this errors.",
      );
      return buildRemoteDirectDatabaseUrl(ref, password);
    }
    console.error(
      "DATABASE_URL が未設定です。次のいずれかを .env に設定してください:\n" +
        "  • DATABASE_URL — Dashboard → Connect の接続文字列（Session pooler 推奨）\n" +
        "  • SUPABASE_DB_PASSWORD — プロジェクト DB パスワード（supabase login / link で ref を自動検出）",
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
    ...(isLocalDatabaseUrl(url) ? {} : { ssl: "require" as const }),
  });
}
