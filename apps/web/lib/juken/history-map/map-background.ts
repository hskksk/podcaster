import { project } from "./geo";
import type { HistoryMapBackground } from "./types";

const MAP_W = 390;
const MAP_H = 405;

/** SVG snippet for a raster map under the vector overlays (clipped to land). */
export function mapBackgroundSvg(bg: HistoryMapBackground, clipPathId: string): string {
  const opacity = bg.opacity ?? 0.55;
  let x = 0;
  let y = 0;
  let w = MAP_W;
  let h = MAP_H;
  let clip = "";
  if (bg.fit === "bounds" && bg.bounds) {
    const [west, south, east, north] = bg.bounds;
    const [x0, y0] = project(west, north);
    const [x1, y1] = project(east, south);
    x = Math.min(x0, x1);
    y = Math.min(y0, y1);
    w = Math.abs(x1 - x0);
    h = Math.abs(y1 - y0);
    clip = ` clip-path="url(#${clipPathId})"`;
  }
  const safeUrl = bg.imageUrl.replace(/"/g, "'");
  return `<image href="${safeUrl}" x="${x}" y="${y}" width="${w}" height="${h}" opacity="${opacity}" preserveAspectRatio="xMidYMid meet"${clip}/>`;
}