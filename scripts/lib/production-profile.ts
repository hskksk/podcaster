import type { ProductionProfile } from "../../supabase/functions/_domain/events.ts";

/** Snapshot podcast_config keys used during production (legacy → events profile). */
export function buildProductionProfile(
  config: Record<string, unknown>,
): ProductionProfile {
  const pickPrefix = (prefix: string): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (key.startsWith(prefix)) {
        out[key.slice(prefix.length)] = value;
      }
    }
    return out;
  };

  return {
    generator: pickPrefix("generator."),
    tts: pickPrefix("tts."),
    image: pickPrefix("image."),
    gemini: {
      ...(pickPrefix("gemini.")),
    },
  };
}

export async function loadPodcastConfigMap(
  sql: import("postgres").Sql,
): Promise<Record<string, unknown>> {
  const rows = await sql<Array<{ key: string; value: unknown }>>`
    select key, value from podcast_config
  `;
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}
