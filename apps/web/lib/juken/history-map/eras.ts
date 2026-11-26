
export type EraDefinition = {
  label: string;
  /** Inclusive lower bound (calendar year). */
  from: number;
  /** Inclusive upper bound (calendar year). */
  to: number;
  color: string;
};

/** Japanese history periods for the scrubber track (aligned with eraLabel). */
export const ERAS: readonly EraDefinition[] = [
  { label: "旧石器", from: -1_000_000, to: -13_000, color: "#9a8b7a" },
  { label: "縄文", from: -12_999, to: -301, color: "#6b9e7a" },
  { label: "弥生", from: -300, to: -1, color: "#5a9e8c" },
  { label: "古墳", from: 0, to: 299, color: "#c4a24a" },
  { label: "飛鳥", from: 300, to: 709, color: "#c97a4a" },
  { label: "奈良", from: 710, to: 793, color: "#b86a9a" },
  { label: "平安", from: 794, to: 1184, color: "#7a6ab8" },
  { label: "鎌倉", from: 1185, to: 1333, color: "#5a7ab8" },
  { label: "室町", from: 1334, to: 1466, color: "#6a8ac4" },
  { label: "戦国", from: 1467, to: 1572, color: "#8a4a4a" },
  { label: "桃山", from: 1573, to: 1602, color: "#a85a5a" },
  { label: "江戸前", from: 1603, to: 1715, color: "#4a6a5a" },
  { label: "江戸中", from: 1716, to: 1840, color: "#5a7a6a" },
  { label: "幕末", from: 1841, to: 1867, color: "#6a8a7a" },
  { label: "明治", from: 1868, to: 1911, color: "#7a5a8a" },
  { label: "大正", from: 1912, to: 1925, color: "#8a6a9a" },
  { label: "昭和戦前", from: 1926, to: 1944, color: "#9a5a6a" },
  { label: "昭和戦後", from: 1945, to: 1988, color: "#8a7a9a" },
  { label: "平成令和", from: 1989, to: 2100, color: "#6a8ab8" },
];

const FULL_LABELS: Record<string, string> = {
  旧石器: "旧石器時代",
  縄文: "縄文時代",
  弥生: "弥生時代",
  古墳: "古墳時代",
  飛鳥: "飛鳥時代",
  奈良: "奈良時代",
  平安: "平安時代",
  鎌倉: "鎌倉時代",
  室町: "南北朝・室町時代",
  戦国: "戦国時代",
  桃山: "安土桃山時代",
  江戸前: "江戸時代(前期)",
  江戸中: "江戸時代(中期)",
  幕末: "江戸時代(後期・幕末)",
  明治: "明治時代",
  大正: "大正時代",
  昭和戦前: "昭和(戦前・戦中)",
  昭和戦後: "昭和(戦後)",
  平成令和: "平成・令和",
};

export function eraLabel(year: number): string {
  for (const era of ERAS) {
    if (year >= era.from && year <= era.to) {
      return FULL_LABELS[era.label] ?? era.label;
    }
  }
  return FULL_LABELS["平成令和"]!;
}

export type EraTrackSpan = {
  label: string;
  fullLabel: string;
  color: string;
  leftPct: number;
  widthPct: number;
};

function eraForYear(year: number): EraDefinition {
  for (const era of ERAS) {
    if (year >= era.from && year <= era.to) return era;
  }
  return ERAS[ERAS.length - 1]!;
}

/** Map era definitions onto discrete year-stop positions for the scrubber track (contiguous, no gaps). */
export function eraTrackSpans(yearStops: number[]): EraTrackSpan[] {
  if (yearStops.length < 2) return [];
  const maxIdx = yearStops.length - 1;
  const spans: EraTrackSpan[] = [];

  let runStart = 0;
  let runEra = eraForYear(yearStops[0]!);

  for (let i = 1; i <= yearStops.length; i++) {
    const nextEra = i < yearStops.length ? eraForYear(yearStops[i]!) : null;
  if (nextEra && nextEra.label === runEra.label) continue;

    const endIdx = i - 1;
    const leftPct = (runStart / maxIdx) * 100;
    const widthPct = endIdx >= maxIdx ? 100 - leftPct : ((endIdx + 1) / maxIdx) * 100 - leftPct;

    spans.push({
      label: runEra.label,
      fullLabel: FULL_LABELS[runEra.label] ?? runEra.label,
      color: runEra.color,
      leftPct,
      widthPct,
    });

    if (i < yearStops.length) {
      runStart = i;
      runEra = nextEra!;
    }
  }
  return spans;
}