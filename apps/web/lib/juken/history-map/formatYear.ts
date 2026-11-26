export function formatYear(year: number): string {
  if (year < 0) return `紀元前${Math.abs(year)}年`;
  return `${year}年`;
}