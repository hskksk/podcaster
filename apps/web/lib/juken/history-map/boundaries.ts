import { project } from "./geo";
import type { HistoryMapGeo } from "./types";

type Seed = { n: string; d: number; dn: string; p: [number, number] };

function buildSeeds(geo: HistoryMapGeo): Seed[] {
  const seeds: Seed[] = [];
  geo.provinces.forEach(([regionName, blob], regionIndex) => {
    blob.split(" ").forEach((token) => {
      const [name, x, y] = token.split(",");
      seeds.push({
        n: name,
        d: regionIndex,
        dn: regionName,
        p: project(Number(x), Number(y)),
      });
    });
  });
  return seeds;
}

function clipHalfPlane(
  poly: [number, number, number][],
  mx: number,
  my: number,
  nx: number,
  ny: number,
  keepNear: number,
  clipNeighbor: number,
): [number, number, number][] {
  const f = (q: [number, number, number]) => (q[0] - mx) * nx + (q[1] - my) * ny;
  const out: [number, number, number][] = [];
  poly.forEach((q, k) => {
    const r = poly[(k + 1) % poly.length]!;
    const fq = f(q);
    const fr = f(r);
    const t = fq / (fq - fr || 1);
    const ix = q[0] + (r[0] - q[0]) * t;
    const iy = q[1] + (r[1] - q[1]) * t;
    if (fq <= keepNear) {
      out.push(q);
      if (fr > keepNear) out.push([ix, iy, clipNeighbor]);
    } else if (fr <= keepNear) {
      out.push([ix, iy, clipNeighbor]);
    }
  });
  return out;
}

function groupCentroids(seeds: Seed[], key: "n" | "dn"): [string, number, number][] {
  const buckets = new Map<string, { x: number; y: number; c: number }>();
  seeds.forEach((s) => {
    const k = s[key];
    const o = buckets.get(k) ?? { x: 0, y: 0, c: 0 };
    o.x += s.p[0];
    o.y += s.p[1];
    o.c += 1;
    buckets.set(k, o);
  });
  return [...buckets.entries()].map(([name, o]) => [name, o.x / o.c, o.y / o.c]);
}

export function computeBoundaries(geo: HistoryMapGeo): {
  provinceEdges: string;
  regionEdges: string;
  provinceLabels: [string, number, number][];
  regionLabels: [string, number, number][];
} {
  const seeds = buildSeeds(geo);
  let provinceEdges = "";
  let regionEdges = "";

  seeds.forEach((a, i) => {
    let poly: [number, number, number][] = [
      [-50, -50, -1],
      [500, -50, -1],
      [500, 500, -1],
      [-50, 500, -1],
    ];
    seeds.forEach((b, j) => {
      if (i === j) return;
      const mx = (a.p[0] + b.p[0]) / 2;
      const my = (a.p[1] + b.p[1]) / 2;
      const nx = b.p[0] - a.p[0];
      const ny = b.p[1] - a.p[1];
      poly = clipHalfPlane(poly, mx, my, nx, ny, 0, j);
    });
    poly.forEach((q, k) => {
      const r = poly[(k + 1) % poly.length]!;
      const j = q[2];
      if (j > i) {
        const b = seeds[j]!;
        if (a.n !== b.n) {
          const seg = `M${q[0].toFixed(1)} ${q[1].toFixed(1)}L${r[0].toFixed(1)} ${r[1].toFixed(1)}`;
          provinceEdges += seg;
          if (a.d !== b.d) regionEdges += seg;
        }
      }
    });
  });

  return {
    provinceEdges,
    regionEdges,
    provinceLabels: groupCentroids(seeds, "n"),
    regionLabels: groupCentroids(seeds, "dn"),
  };
}