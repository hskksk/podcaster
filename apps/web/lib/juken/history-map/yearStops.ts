/** Discrete slider positions (actual calendar years), ascending. */
export function buildYearStops(eventYears: number[], explicit?: number[]): number[] {
  const merged = explicit?.length ? [...explicit, ...eventYears] : eventYears;
  return [...new Set(merged)].sort((a, b) => a - b);
}

export function yearStopIndex(year: number, stops: number[]): number {
  if (!stops.length) return 0;
  let i = stops.findIndex((y) => y >= year);
  if (i < 0) return stops.length - 1;
  if (stops[i] === year) return i;
  if (i === 0) return 0;
  return i - 1;
}

export function snapYearToStop(year: number, stops: number[]): number {
  if (!stops.length) return year;
  return stops[yearStopIndex(year, stops)]!;
}