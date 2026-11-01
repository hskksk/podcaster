import type postgres from "postgres";
import { connectPostgres } from "./postgres-connect.ts";

export type PipelineMode = "legacy" | "events";

export function normalizePipelineMode(raw: unknown): PipelineMode {
  const s = String(raw ?? "legacy").replace(/"/g, "").trim();
  return s === "events" ? "events" : "legacy";
}

export async function readPipelineMode(
  sql: postgres.Sql = connectPostgres(),
): Promise<PipelineMode> {
  const rows = await sql<Array<{ value: unknown }>>`
    select value from podcast_config where key = 'pipeline.mode' limit 1
  `;
  return normalizePipelineMode(rows[0]?.value);
}

export async function writePipelineMode(
  mode: PipelineMode,
  sql: postgres.Sql = connectPostgres(),
): Promise<void> {
  await sql`
    insert into podcast_config (key, value)
    values ('pipeline.mode', ${JSON.stringify(mode)}::jsonb)
    on conflict (key) do update set value = excluded.value
  `;
}
