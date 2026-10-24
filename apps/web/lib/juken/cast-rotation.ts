import type { CharacterId } from "./characters";

/** Monday of the 1970-01-05 week — rotation epoch (must match story-rules.md). */
const ROTATION_EPOCH_UTC = Date.UTC(1970, 0, 5);

const BIWEEKLY_CAST: readonly (readonly CharacterId[])[] = [
  ["kuma", "tora", "neko", "kitsu"],
  ["kuma", "miju", "ichi", "tako"],
  ["tora", "neko", "nasu", "ramen"],
];

function mondayWeekIndex(weekMondayIso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekMondayIso);
  if (!match) return 0;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const mondayUtc = Date.UTC(y, m - 1, d);
  const diffDays = (mondayUtc - ROTATION_EPOCH_UTC) / 86_400_000;
  return Math.floor(diffDays / 7);
}

/** Four character IDs that may appear in lessons for this Monday-dated week folder. */
export function activeCastForWeek(weekMondayIso: string): CharacterId[] {
  const block = Math.floor(mondayWeekIndex(weekMondayIso) / 2) % BIWEEKLY_CAST.length;
  return [...BIWEEKLY_CAST[block]!];
}
