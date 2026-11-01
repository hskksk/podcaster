import { execSync } from "node:child_process";
import postgres from "postgres";
import {
  fetchSessionPoolerDatabaseUrl,
  isLocalDatabaseUrl,
  poolerDatabaseUrlFromLinkedProject,
} from "./remote-postgres-url.ts";
import { detectProjectRef } from "./supabase-detect.ts";

const DEFAULT_LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const target = process.env.TARGET ?? "remote";
  if (target !== "local") {
    const password = process.env.SUPABASE_DB_PASSWORD;
    if (password) {
      const ref = detectProjectRef();
      const fromLink = poolerDatabaseUrlFromLinkedProject(ref, password);
      const poolerUrl = fromLink ?? fetchSessionPoolerDatabaseUrl(ref, password);
      if (poolerUrl) {
        console.log(
          fromLink
            ? `Using session pooler for project ${ref} (supabase/.temp/pooler-url from link).`
            : `Using session pooler for project ${ref} (SUPABASE_DB_PASSWORD + Management API).`,
        );
        return poolerUrl;
      }
      console.error(
        "Session pooler URL を解決できませんでした。次のいずれかを行ってください:\n" +
          "  • .env に DATABASE_URL — Dashboard → Connect → Session pooler\n" +
          "  • リポジトリで supabase link --project-ref <ref>（pooler-url を supabase/.temp/ に保存）\n" +
          "  • .env に SUPABASE_ACCESS_TOKEN（Dashboard → Account → Tokens）\n" +
          "\n" +
          "db.<ref>.supabase.co への直結は IPv6/DNS 環境で ENOTFOUND になりやすいため、自動では使いません。",
      );
      process.exit(1);
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
  const remote = !isLocalDatabaseUrl(url);
  const transactionPooler = remote && /:6543(\/|$)/.test(url);
  return postgres(url, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    ...(remote ? { ssl: "require" as const } : {}),
    ...(transactionPooler ? { prepare: false } : {}),
  });
}
