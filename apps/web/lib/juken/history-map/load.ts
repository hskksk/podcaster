import "server-only";

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { historyMapGeoPath, historyMapRenderPath, historyMapTopologyPath, jukenDir } from "../../repo-root";
import { boundariesFromRender } from "./boundaries";
import { buildYearStops, snapYearToStop } from "./yearStops";
import type {
  HistoryEvent,
  HistoryFigure,
  HistoryMapBundle,
  HistoryMapGeo,
  HistoryMapRenderCache,
  HistoryMapTopology,
  HistoryMapMeta,
  HistoryMapTaxonomy,
  WarOverlay,
} from "./types";

export const HISTORY_MAP_DIR = "history-map";

function bundleRoot(): string {
  return path.join(jukenDir(), HISTORY_MAP_DIR);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function historyMapAvailable(): boolean {
  const root = bundleRoot();
  return (
    fs.existsSync(path.join(root, "events.json")) &&
    fs.existsSync(path.join(root, "meta.yml")) &&
    fs.existsSync(historyMapGeoPath()) &&
    fs.existsSync(historyMapRenderPath())
  );
}

export function loadHistoryMapBundle(): HistoryMapBundle | null {
  if (!historyMapAvailable()) return null;
  const root = bundleRoot();
  const metaRaw = yaml.load(fs.readFileSync(path.join(root, "meta.yml"), "utf8")) as HistoryMapMeta;
  const events = readJson<HistoryEvent[]>(path.join(root, "events.json"));
  const yearStops = buildYearStops(
    events.map((e) => e.year),
    metaRaw.yearStops,
  );
  const meta: HistoryMapMeta = {
    ...metaRaw,
    yearStops,
    defaultYear: snapYearToStop(metaRaw.defaultYear, yearStops),
  };
  const wars = readJson<Record<string, WarOverlay>>(path.join(root, "wars.json"));
  const taxonomy = readJson<HistoryMapTaxonomy>(path.join(root, "taxonomy.json"));
  const geoRaw = readJson<HistoryMapGeo>(historyMapGeoPath());
  const render = readJson<HistoryMapRenderCache>(historyMapRenderPath());
  const geo: HistoryMapGeo = { ...geoRaw, land: render.land };
  const boundaries = boundariesFromRender(render);
  const topologyPath = historyMapTopologyPath();
  const topology = fs.existsSync(topologyPath) ? readJson<HistoryMapTopology>(topologyPath) : undefined;
  const figuresPath = path.join(root, "figures.json");
  const figures = fs.existsSync(figuresPath) ? readJson<Record<string, HistoryFigure>>(figuresPath) : {};
  return { meta, events, wars, taxonomy, geo, render, topology, boundaries, figures };
}