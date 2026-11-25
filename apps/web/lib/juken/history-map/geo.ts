/** Project lat/lng to SVG coords (matches prototype). */
export function project(lng: number, lat: number): [number, number] {
  return [(lng - 128.5) * 22, (45.8 - lat) * 26];
}

/** Skip midpoint insertion on short edges (map SVG units). */
const MIN_SEGMENT_MAP_UNITS = 14;

function parseMapPairs(ring: string): [number, number][] {
  return ring
    .split(/[\s]+/)
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return [x, y] as [number, number];
    });
}

function formatMapPairs(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/** Insert one midpoint per edge when edge length >= minLen (closed ring). */
export function densifyClosedRing(
  points: [number, number][],
  minLen = MIN_SEGMENT_MAP_UNITS,
): [number, number][] {
  if (points.length < 2) return points;
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    out.push(a);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= minLen) {
      out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    }
  }
  return out;
}

function densifyMapRing(ring: string, minLen = MIN_SEGMENT_MAP_UNITS): string {
  const pts = parseMapPairs(ring);
  return formatMapPairs(densifyClosedRing(pts, minLen));
}

export function landPolygons(land: string[]): string[] {
  return land.map((ring) => {
    const projected = ring.split(" ").map((pair) => {
      const [lng, lat] = pair.split(",").map(Number);
      return project(lng, lat);
    });
    return formatMapPairs(densifyClosedRing(projected));
  });
}

/** Rings already in SVG map space (from geo import), not lng/lat. */
export function mapSpacePolygons(rings: string[]): string[] {
  return rings.map((ring) => densifyMapRing(ring));
}