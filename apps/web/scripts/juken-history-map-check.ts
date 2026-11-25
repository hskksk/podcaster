import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { historyMapGeoPath, historyMapRenderPath, historyMapTopologyPath, jukenDir } from "../../../scripts/lib/content-paths";

const root = path.join(jukenDir(), "history-map");
const metaPath = path.join(root, "meta.yml");
const eventsPath = path.join(root, "events.json");
const warsPath = path.join(root, "wars.json");

if (!fs.existsSync(eventsPath) || !fs.existsSync(metaPath)) {
  console.error("juken-history-map-check: no bundle at content/juken/history-map (set CONTENT_ROOT?)");
  process.exit(1);
}
if (!fs.existsSync(historyMapGeoPath())) {
  console.error(`juken-history-map-check: missing geo at ${historyMapGeoPath()}`);
  process.exit(1);
}
if (!fs.existsSync(historyMapRenderPath())) {
  console.error(`juken-history-map-check: missing render at ${historyMapRenderPath()}`);
  process.exit(1);
}
if (!fs.existsSync(historyMapTopologyPath())) {
  console.error(`juken-history-map-check: missing topology at ${historyMapTopologyPath()}`);
  process.exit(1);
}

const meta = yaml.load(fs.readFileSync(metaPath, "utf8")) as { yearMin: number; yearMax: number };
const events = JSON.parse(fs.readFileSync(eventsPath, "utf8")) as { year: number; axis: string; title: string }[];
const wars = JSON.parse(fs.readFileSync(warsPath, "utf8")) as Record<string, unknown>;

let errors = 0;
for (const e of events) {
  if (e.year < meta.yearMin || e.year > meta.yearMax) {
    console.error(`juken-history-map-check: year out of range: ${e.title} (${e.year})`);
    errors++;
  }
  if (e.axis === "w" && !wars[e.title]) {
    console.warn(`juken-history-map-check: warn war event without overlay: ${e.title}`);
  }
}

for (let i = 1; i < events.length; i++) {
  if (events[i]!.year < events[i - 1]!.year) {
    console.error("juken-history-map-check: events.json is not sorted by year");
    errors++;
    break;
  }
}

const figuresPath = path.join(root, "figures.json");
if (fs.existsSync(figuresPath)) {
  const figures = JSON.parse(fs.readFileSync(figuresPath, "utf8")) as Record<
    string,
    { name?: string; imageUrl?: string; license?: string; credit?: string; sourceUrl?: string }
  >;
  for (const [key, fig] of Object.entries(figures)) {
    if (!fig.imageUrl || !fig.license || !fig.credit || !fig.sourceUrl) {
      console.error(`juken-history-map-check: incomplete figure: ${key}`);
      errors++;
    }
    if (fig.imageUrl && isLikelyNonPortraitFile(fig.imageUrl)) {
      console.error(`juken-history-map-check: non-portrait image (花押など): ${key}`);
      errors++;
    }
  }
  console.log(`juken-history-map-check: figures ${Object.keys(figures).length}`);
}

const knowledgesGeo = path.join(root, "geo.json");
if (fs.existsSync(knowledgesGeo)) {
  console.warn("juken-history-map-check: warn geo.json still in knowledges (should be podcaster-only)");
}

function isLikelyNonPortraitFile(url: string): boolean {
  const base = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "").toLowerCase();
  return /(?:^|[_\s.-])(kaou|kao|kaku|inpo|inko)|花押|署名|印章|family[\s_-]?crest|coat[\s_-]?of[\s_-]?arms|_kaou\b|_kao\b/.test(
    base,
  );
}

const render = JSON.parse(fs.readFileSync(historyMapRenderPath(), "utf8")) as {
  land?: string[];
  regionFills?: unknown[];
};
if (!render.land?.length || !render.regionFills?.length) {
  console.error("juken-history-map-check: render.json missing land or regionFills");
  errors++;
}

if (errors > 0) process.exit(1);
console.log(`juken-history-map-check: ok (${events.length} events)`);