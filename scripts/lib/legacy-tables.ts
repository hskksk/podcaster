import type { connectPostgres } from "./postgres-connect.ts";

type Sql = ReturnType<typeof connectPostgres>;

/** True while pre–drop migration legacy tables still exist. */
export async function legacyPipelineTablesExist(sql: Sql): Promise<boolean> {
  const rows = await sql<Array<{ exists: boolean }>>`
    select to_regclass('public.legacy_articles') is not null as exists
  `;
  return rows[0]?.exists === true;
}
