import type { HistoryAxis, HistoryEvent } from "./types";

export { eraLabel } from "./eras";

export function visibleEvents(
  events: HistoryEvent[],
  level: number,
  axesOn: Set<HistoryAxis>,
): HistoryEvent[] {
  return events
    .filter((e) => e.level <= level && axesOn.has(e.axis))
    .sort((a, b) => a.year - b.year);
}

export function currentEvent(visible: HistoryEvent[], year: number, selected: HistoryEvent | null): HistoryEvent | null {
  if (selected && visible.includes(selected) && selected.year <= year) return selected;
  const past = visible.filter((e) => e.year <= year);
  return past[past.length - 1] ?? null;
}

export function laneName(event: HistoryEvent, laneByTitle: Record<string, string>): string {
  return laneByTitle[event.title] ?? "その他";
}