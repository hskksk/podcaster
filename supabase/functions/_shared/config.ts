import { createSupabaseClient } from "./db.ts";
import type { PodcastConfigMap } from "./types.ts";

let cached: PodcastConfigMap | null = null;

export async function loadConfig(): Promise<PodcastConfigMap> {
  if (cached) return cached;

  const db = createSupabaseClient();
  const { data, error } = await db
    .from("podcast_config")
    .select("key, value");
  if (error) throw new Error(`Failed to load podcast_config: ${error.message}`);

  const map: Record<string, unknown> = {};
  for (const row of data) {
    map[row.key] = row.value;
  }
  cached = map as PodcastConfigMap;
  return cached;
}
