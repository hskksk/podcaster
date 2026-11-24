import type { HistoryAxis, HistoryEvent } from "./types";

export function eraLabel(year: number): string {
  if (year < 1185) return "平安時代の終わり";
  if (year < 1334) return "鎌倉時代";
  if (year < 1467) return "南北朝・室町時代";
  if (year < 1573) return "戦国時代";
  if (year < 1603) return "安土桃山時代";
  if (year < 1716) return "江戸時代(前期)";
  if (year < 1841) return "江戸時代(中期)";
  return "江戸時代(後期・幕末)";
}

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