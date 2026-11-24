import "server-only";

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { jukenDir } from "../../repo-root";
import { computeBoundaries } from "./boundaries";
import type {
  HistoryEvent,
  HistoryFigure,
  HistoryMapBackground,
  HistoryMapBundle,
  HistoryMapGeo,
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
  return fs.existsSync(path.join(root, "events.json")) && fs.existsSync(path.join(root, "meta.yml"));
}

export function loadHistoryMapBundle(): HistoryMapBundle | null {
  if (!historyMapAvailable()) return null;
  const root = bundleRoot();
  const meta = yaml.load(fs.readFileSync(path.join(root, "meta.yml"), "utf8")) as HistoryMapMeta;
  const events = readJson<HistoryEvent[]>(path.join(root, "events.json"));
  const wars = readJson<Record<string, WarOverlay>>(path.join(root, "wars.json"));
  const taxonomy = readJson<HistoryMapTaxonomy>(path.join(root, "taxonomy.json"));
  const geo = readJson<HistoryMapGeo>(path.join(root, "geo.json"));
  const boundaries = computeBoundaries(geo);
  const figuresPath = path.join(root, "figures.json");
  const figures = fs.existsSync(figuresPath) ? readJson<Record<string, HistoryFigure>>(figuresPath) : {};
  const bgPath = path.join(root, "map-background.json");
  const mapBackground = fs.existsSync(bgPath) ? readJson<HistoryMapBackground>(bgPath) : null;
  return { meta, events, wars, taxonomy, geo, boundaries, figures, mapBackground };
}