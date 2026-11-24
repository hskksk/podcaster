/** Split a ring if consecutive points jump (merged subpaths artifact). */
export function splitProjectedRing(ring: string, maxSegment = 55): string[] {
  const pairs = ring.split(" ").map((p) => p.trim()).filter(Boolean);
  if (pairs.length < 4) return ring ? [ring] : [];
  const pts = pairs.map((p) => p.split(",").map(Number) as [number, number]);
  const out: string[][] = [];
  let cur: [number, number][] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const jump = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (jump > maxSegment) {
      if (cur.length >= 4) out.push(cur);
      cur = [b];
    } else {
      cur.push(b);
    }
  }
  if (cur.length >= 4) out.push(cur);
  return out.map((r) => r.map(([x, y]) => `${x},${y}`).join(" "));
}