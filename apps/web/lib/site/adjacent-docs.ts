import { loadPublicDocsForRequest } from "./content-for-request";
import type { PublicDoc } from "./docs";
import { loadPublicDocs } from "./docs";

export type AdjacentDocs = {
  prev: PublicDoc | null;
  next: PublicDoc | null;
};

export function adjacentPublicDocs(slug: string): AdjacentDocs {
  const docs = loadPublicDocs();
  const i = docs.findIndex((d) => d.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? docs[i - 1]! : null,
    next: i < docs.length - 1 ? docs[i + 1]! : null,
  };
}

export async function adjacentPublicDocsForRequest(slug: string): Promise<AdjacentDocs> {
  const docs = await loadPublicDocsForRequest();
  const i = docs.findIndex((d) => d.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? docs[i - 1]! : null,
    next: i < docs.length - 1 ? docs[i + 1]! : null,
  };
}
