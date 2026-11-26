import type { HistoryAxis, HistoryEvent } from "./types";

export function eraLabel(year: number): string {
  if (year <= -13000) return "旧石器時代";
  if (year < -300) return "縄文時代";
  if (year < 0) return "弥生時代";
  if (year < 300) return "古墳時代";
  if (year < 710) return "飛鳥時代";
  if (year < 794) return "奈良時代";
  if (year < 1185) return "平安時代";
  if (year < 1334) return "鎌倉時代";
  if (year < 1467) return "南北朝・室町時代";
  if (year < 1573) return "戦国時代";
  if (year < 1603) return "安土桃山時代";
  if (year < 1716) return "江戸時代(前期)";
  if (year < 1841) return "江戸時代(中期)";
  if (year < 1868) return "江戸時代(後期・幕末)";
  if (year < 1912) return "明治時代";
  if (year < 1926) return "大正時代";
  if (year < 1945) return "昭和(戦前・戦中)";
  if (year < 1989) return "昭和(戦後)";
  return "平成・令和";
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