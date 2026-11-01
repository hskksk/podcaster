import postgres from "npm:postgres@3.4.7";
import type { Sql } from "../eventstore/postgres.ts";

let cached: postgres.Sql | null = null;

export function getPostgresSql(): Sql {
  if (cached) return cached as Sql;
  const url = Deno.env.get("SUPABASE_DB_URL") ?? Deno.env.get("DATABASE_URL");
  if (!url) {
    throw new Error("SUPABASE_DB_URL or DATABASE_URL is required for domain event store");
  }
  cached = postgres(url, {
    max: 2,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return cached as Sql;
}

export async function closePostgresSql(): Promise<void> {
  if (cached) {
    await cached.end({ timeout: 5 });
    cached = null;
  }
}
