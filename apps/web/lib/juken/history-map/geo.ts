/** Project lat/lng to SVG coords (matches prototype). */
export function project(lng: number, lat: number): [number, number] {
  return [(lng - 128.5) * 22, (45.8 - lat) * 26];
}

export function landPolygons(land: string[]): string[] {
  return land.map((ring) =>
    ring
      .split(" ")
      .map((pair) => {
        const [lng, lat] = pair.split(",").map(Number);
        return project(lng, lat).join(",");
      })
      .join(" "),
  );
}