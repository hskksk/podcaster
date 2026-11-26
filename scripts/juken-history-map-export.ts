/**
 * One-shot / maintenance: parse prototype HTML → knowledges content/juken/history-map/*.json
 * Usage: pnpm exec tsx scripts/juken-history-map-export.ts [path/to.html] [outDir]
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { getMonorepoRoot, historyMapGeoPath } from "./lib/content-paths.ts";

const htmlPath =
  process.argv[2] ??
  "/home/ubuntu/.cursor/projects/agent-repos-podcaster/uploads/_____________________1050.html";
const outDir =
  process.argv[3] ?? path.join(path.dirname(new URL(import.meta.url).pathname), "../../knowledges/content/juken/history-map");

const html = fs.readFileSync(htmlPath, "utf8");

function sliceConst(name: string, end: string): string {
  const re = new RegExp(`const ${name}=([\\s\\S]*?)${end}`);
  const m = html.match(re);
  if (!m) throw new Error(`missing const ${name}`);
  return m[1]!.trim();
}

const anchors = {
  KY: [135.76, 35.01],
  KM: [139.55, 35.32],
  HK: [130.4, 33.6],
  HI: [141.1, 39.0],
  ED: [139.77, 35.68],
} as const;

function resolveCoord(v: unknown, tuple: readonly number[]): number {
  if (typeof v === "number") return v;
  if (v === "...KY") return tuple[0];
  if (v === "...KM") return tuple[1];
  if (v === "...HK") return tuple[0];
  if (v === "...HI") return tuple[0];
  if (v === "...ED") return tuple[0];
  throw new Error(`unknown coord spread: ${String(v)}`);
}

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const E = new Function(
  `const KY=${JSON.stringify(anchors.KY)};const KM=${JSON.stringify(anchors.KM)};const HK=${JSON.stringify(anchors.HK)};const HI=${JSON.stringify(anchors.HI)};const ED=${JSON.stringify(anchors.ED)};return (${sliceConst("E", "].map")}]);`,
)() as [number, number, string, number, number, string, string, string, string][];

const events = E.map((a) => ({
  year: a[0],
  level: a[1],
  axis: a[2],
  lng: a[3],
  lat: a[4],
  place: a[5],
  who: a[6],
  title: a[7],
  body: a[8],
})).sort((a, b) => a.year - b.year);

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const AX = new Function(`return ${sliceConst("AX", ";")};`)() as Record<string, [string, string]>;
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const LV = new Function(`return ${sliceConst("LV", ";")};`)() as string[];
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const WAR = new Function(`return ${sliceConst("WAR", ";")};`)() as Record<
  string,
  { ar: [number, number, number, number]; pp: [string, number, number, number, number][] }
>;
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const LAND = new Function(`return ${sliceConst("LAND", ";")};`)() as string[];
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const KN = new Function(`return ${sliceConst("KN", ";")};`)() as [string, string][];
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const LN = new Function(`return ${sliceConst("LN", ";")};`)() as Record<string, string>;
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const LORD = new Function(`return ${sliceConst("LORD", ";")};`)() as Record<string, string[]>;

fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, "events.json"), `${JSON.stringify(events, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, "wars.json"), `${JSON.stringify(WAR, null, 2)}\n`);
fs.writeFileSync(
  path.join(outDir, "taxonomy.json"),
  `${JSON.stringify({ axes: AX, levelLabels: LV, laneByTitle: LN, laneOrder: LORD, anchors }, null, 2)}\n`,
);
const geoPayload = { land: LAND, provinces: KN };
const geoOut = process.env.HISTORY_MAP_GEO_OUT ?? historyMapGeoPath();
fs.mkdirSync(path.dirname(geoOut), { recursive: true });
fs.writeFileSync(geoOut, `${JSON.stringify(geoPayload, null, 2)}\n`);
console.log(`wrote geo → ${geoOut}`);

const meta = {
  id: "medieval-edo",
  title: "日本史ものがたりマップ",
  subtitle: "中世〜江戸",
  yearMin: 1080,
  yearMax: 1870,
  defaultYear: 1080,
  mapViewBox: [0, 0, 390, 405],
};
fs.writeFileSync(path.join(outDir, "meta.yml"), yaml.dump(meta));

console.log(`wrote history-map knowledge bundle to ${outDir} (${events.length} events)`);
console.log(`podcaster root: ${getMonorepoRoot()}`);