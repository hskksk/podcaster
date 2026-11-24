import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { jukenDir } from "../../../scripts/lib/content-paths";

const root = path.join(jukenDir(), "history-map");
const metaPath = path.join(root, "meta.yml");
const eventsPath = path.join(root, "events.json");
const warsPath = path.join(root, "wars.json");

if (!fs.existsSync(eventsPath) || !fs.existsSync(metaPath)) {
  console.error("juken-history-map-check: no bundle at content/juken/history-map (set CONTENT_ROOT?)");
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
  }
  console.log(`juken-history-map-check: figures ${Object.keys(figures).length}`);
}

const geoPath = path.join(root, "geo.json");
if (fs.existsSync(geoPath)) {
  const geo = JSON.parse(fs.readFileSync(geoPath, "utf8")) as {
    regions?: { name?: string; color?: string; rings?: string[] }[];
  };
  if (geo.regions?.length) {
    for (const region of geo.regions) {
      if (!region.name || !region.color || !region.rings?.length) {
        console.error(`juken-history-map-check: incomplete region: ${region.name ?? "?"}`);
        errors++;
      }
    }
    console.log(`juken-history-map-check: gokishichido regions ${geo.regions.length}`);
  }
}

if (errors > 0) process.exit(1);
console.log(`juken-history-map-check: ok (${events.length} events)`);