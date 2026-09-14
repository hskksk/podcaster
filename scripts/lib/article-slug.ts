/**
 * Public Pages slug / date from a legacy articles/ or inbox/ basename.
 * Directory names under content/ are not the public slug — always pass
 * `legacyFilename` (e.g. `20260512_100000_markdoc_features.md`).
 */

/** Strip a leading YYYYMMDD and optional _HHMMSS_, then the .md/.mdoc suffix. */
export function parseSlugFromFilename(filename: string): string {
  return filename
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/^\d{8}(_\d{6})?_/, "")
    .replace(/\.(md|mdoc)$/, "");
}

export function parseDateFromFilename(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop()!;
  const m = base.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** Filename clock as ISO-8601 UTC (`YYYYMMDD_HHMMSS` → `YYYY-MM-DDTHH:MM:SS.000Z`). */
export function parseClippedAtFromFilename(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop()!;
  const m = base.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
  const date = parseDateFromFilename(base);
  return date ? `${date}T00:00:00.000Z` : "";
}
