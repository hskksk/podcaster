import { connectPostgres } from "./postgres-connect.ts";

const DEFAULT_SHOW_ID = "00000000-0000-4000-8000-000000000001";

export type ShowChannelMeta = {
  title: string;
  description: string;
  coverStoragePath: string | null;
};

export async function loadShowChannelMeta(): Promise<ShowChannelMeta> {
  const sql = connectPostgres();
  const rows = await sql<Array<{
    title: string;
    description: string;
    cover_path: string | null;
  }>>`
    select s.title, s.description, b.storage_path as cover_path
    from podcast.shows s
    left join podcast.blobs b on b.id = s.cover_blob_id
    where s.id = ${DEFAULT_SHOW_ID}::uuid
    limit 1
  `;
  await sql.end();
  const row = rows[0];
  return {
    title: row?.title?.trim() || "Podcast",
    description: row?.description ?? "",
    coverStoragePath: row?.cover_path ?? null,
  };
}
