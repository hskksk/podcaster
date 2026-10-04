/**
 * Heading slug rules aligned with @hskksk/markdoc-react (server-safe copy;
 * the package is client-only and cannot be imported from RSC).
 */
export function markdocSlugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
