export type HistoryAxis = "s" | "w" | "r" | "c" | "e";

export type HistoryEvent = {
  year: number;
  level: 1 | 2 | 3;
  axis: HistoryAxis;
  lng: number;
  lat: number;
  place: string;
  who: string;
  title: string;
  body: string;
};

export type WarOverlay = {
  ar: [number, number, number, number];
  pp: [string, number, number, number, number][];
};

export type HistoryMapMeta = {
  id: string;
  title: string;
  subtitle: string;
  yearMin: number;
  yearMax: number;
  defaultYear: number;
  mapViewBox: [number, number, number, number];
};

export type HistoryMapTaxonomy = {
  axes: Record<HistoryAxis, [string, string]>;
  levelLabels: string[];
  laneByTitle: Record<string, string>;
  laneOrder: Record<string, string[]>;
  anchors: Record<string, [number, number]>;
};

export type HistoryMapGeo = {
  land: string[];
  provinces: [string, string][];
};

export type MapBoundaries = {
  provinceEdges: string;
  regionEdges: string;
  provinceLabels: [string, number, number][];
  regionLabels: [string, number, number][];
};

export type HistoryMapBundle = {
  meta: HistoryMapMeta;
  events: HistoryEvent[];
  wars: Record<string, WarOverlay>;
  taxonomy: HistoryMapTaxonomy;
  geo: HistoryMapGeo;
  boundaries: MapBoundaries;
};