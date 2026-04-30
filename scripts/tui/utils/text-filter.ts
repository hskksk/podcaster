/** Case-insensitive substring match across joined fields. Empty query matches all. */
export function matchesTextFilter(
  filterQuery: string,
  parts: Array<string | number | null | undefined>
): boolean {
  const q = filterQuery.trim().toLowerCase();
  if (!q) return true;
  const hay = parts
    .filter((v): v is string | number => v != null && v !== '')
    .map(v => String(v))
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}
