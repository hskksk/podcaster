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
  /** Slider snaps to these years only. Omitted: derived from unique event years. */
  yearStops?: number[];
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
  provinces?: [string, string][];
  regions?: HistoryMapRegion[];
  sourceNote?: string;
};

export type HistoryMapRenderCache = {
  meta: { topologyVersion: number };
  land: string[];
  regionFills: {
    areaId: string;
    regionId: string;
    name: string;
    region: string;
    color: string;
    points: string;
  }[];
  provinceEdges: string;
  regionEdges: string;
  coastEdges?: string;
  provinceLabels: [string, number, number][];
  regionLabels: [string, number, number][];
};

export type HistoryMapTopology = {
  meta: { version: number; source?: string; snapEpsDeg?: number; sourceNote?: string };
  points: [number, number][];
  edges: [number, number][];
  edgeAreas: Record<string, string[]>;
  areas: {
    id: string;
    regionId: string;
    label: string;
    loops: { edges: { e: number; forward: boolean }[] }[];
  }[];
  regions: { id: string; name: string; areaIds: string[]; fill?: string }[];
};

export type HistoryFigure = {
  name: string;
  aliases?: string[];
  imageUrl: string;
  credit: string;
  license: string;
  sourceUrl: string;
  pageUrl?: string;
};

export type HistoryMapRegion = {
  name: string;
  color: string;
  /** Projected SVG-space rings (`x,y` pairs). */
  rings: string[];
};

export type RegionFillCell = {
  name: string;
  region: string;
  color: string;
  points: string;
};

export type MapBoundaries = {
  provinceEdges: string;
  regionEdges: string;
  provinceLabels: [string, number, number][];
  regionLabels: [string, number, number][];
  regionFills: RegionFillCell[];
};

export type HistoryMapBundle = {
  meta: HistoryMapMeta;
  events: HistoryEvent[];
  wars: Record<string, WarOverlay>;
  taxonomy: HistoryMapTaxonomy;
  geo: HistoryMapGeo;
  render: HistoryMapRenderCache;
  topology?: HistoryMapTopology;
  boundaries: MapBoundaries;
  figures: Record<string, HistoryFigure>;
};