/** Sort collection list by leading YYYYMMDD in directory slug, newest first. */
export function parseSlugForSort(slug: string): string {
  const m = slug.match(/^(\d{8})/);
  if (m) {
    const ymd = m[1];
    return String(99999999 - Number(ymd));
  }
  return slug;
}
