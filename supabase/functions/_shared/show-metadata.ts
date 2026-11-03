import type { Sql } from "../_adapters/eventstore/postgres.ts";
import { DEFAULT_SHOW_ID } from "../_domain/events.ts";

export type RssChannelMeta = {
  title: string;
  description: string;
  coverUrl: string;
};

export async function loadShowChannelMeta(
  sql: Sql,
  storagePublicBase: string,
): Promise<RssChannelMeta> {
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
  const row = rows[0];
  const title = row?.title?.trim() || "Podcast";
  const description = row?.description ?? "";
  const coverPath = row?.cover_path?.replace(/^\//, "") ?? "cover.png";
  const coverUrl = coverPath.startsWith("http")
    ? coverPath
    : `${storagePublicBase}/${coverPath}`;
  return { title, description, coverUrl };
}
