import type { HistoryFigure } from "./types";

export type FigureIndex = {
  byLabel: Map<string, HistoryFigure>;
  labels: string[];
};

export function buildFigureIndex(figures: Record<string, HistoryFigure>): FigureIndex {
  const byLabel = new Map<string, HistoryFigure>();
  for (const fig of Object.values(figures)) {
    byLabel.set(fig.name, fig);
    fig.aliases?.forEach((a) => byLabel.set(a, fig));
  }
  const labels = [...byLabel.keys()].sort((a, b) => b.length - a.length);
  return { byLabel, labels };
}

/** Split plain text into segments, linking known figure names. */
export function segmentFigureText(
  text: string,
  index: FigureIndex,
): { text: string; figure?: HistoryFigure }[] {
  if (!index.labels.length || text.includes("？")) {
    return [{ text }];
  }
  const out: { text: string; figure?: HistoryFigure }[] = [];
  let i = 0;
  while (i < text.length) {
    let matched: { label: string; figure: HistoryFigure } | null = null;
    for (const label of index.labels) {
      if (text.startsWith(label, i)) {
        matched = { label, figure: index.byLabel.get(label)! };
        break;
      }
    }
    if (matched) {
      out.push({ text: matched.label, figure: matched.figure });
      i += matched.label.length;
    } else {
      const next = out[out.length - 1];
      const ch = text[i]!;
      if (next && !next.figure) next.text += ch;
      else out.push({ text: ch });
      i++;
    }
  }
  return out;
}

export function primaryFigureForWho(who: string, index: FigureIndex): HistoryFigure | null {
  const parts = who.split(/[・]/);
  for (const part of parts) {
    const name = part.replace(/\(.*\)/, "").trim();
    const fig = index.byLabel.get(name);
    if (fig) return fig;
  }
  return null;
}