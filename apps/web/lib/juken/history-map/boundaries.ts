import type { HistoryMapRenderCache, MapBoundaries, RegionFillCell } from "./types";

/** 道ごとの塗り（Gokishichido 由来パレットに近い淡色） */
export const REGION_FILL_COLORS: Record<string, string> = {
  畿内: "#e8c468",
  東海道: "#f0a0a0",
  東山道: "#f5c99a",
  北陸道: "#c8c8d8",
  山陰道: "#a8b4e8",
  山陽道: "#e8d060",
  南海道: "#b8c8a0",
  西海道: "#d8dcd0",
  蝦夷地: "#9ec8e0",
};

export function boundariesFromRender(render: HistoryMapRenderCache): MapBoundaries {
  const regionFills: RegionFillCell[] = render.regionFills.map((cell) => ({
    name: cell.name,
    region: cell.region,
    color: cell.color,
    points: cell.points,
  }));
  return {
    provinceEdges: render.provinceEdges,
    regionEdges: render.regionEdges,
    provinceLabels: render.provinceLabels,
    regionLabels: render.regionLabels,
    regionFills,
  };
}