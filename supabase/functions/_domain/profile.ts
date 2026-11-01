import type { ProductionProfile } from "./events.ts";

/** Whether episode artwork jobs should run (matches legacy podcast_config semantics). */
export function isArtworkEnabled(profile: ProductionProfile): boolean {
  const image = profile.image ?? {};
  const v = (image as Record<string, unknown>).enabled;
  if (v === false || v === "false" || v === 0) return false;
  return true;
}

/** Flatten nested production profile to legacy podcast_config keys for job handlers. */
export function flattenProductionProfile(profile: ProductionProfile): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const prefixes: Array<[keyof ProductionProfile, string]> = [
    ["generator", "generator."],
    ["tts", "tts."],
    ["image", "image."],
    ["gemini", "gemini."],
  ];
  for (const [section, prefix] of prefixes) {
    const block = profile[section];
    if (!block || typeof block !== "object") continue;
    for (const [key, value] of Object.entries(block as Record<string, unknown>)) {
      out[`${prefix}${key}`] = value;
    }
  }
  return out;
}
