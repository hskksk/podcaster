import "server-only";

import { getDraftPreviewContext } from "./draft-context";
import { loadPublicDocsFromRef, loadPublicWebClipsFromRef } from "./github-mdoc";
import { loadPublicDoc, loadPublicDocs, type PublicDoc } from "./docs";
import { loadPublicWebClip, loadPublicWebClips, type PublicWebClip } from "./web-clips";

export async function loadPublicDocsForRequest(): Promise<PublicDoc[]> {
  const draft = await getDraftPreviewContext();
  if (draft.enabled && draft.branch) {
    return loadPublicDocsFromRef(draft.branch, draft.githubToken);
  }
  return loadPublicDocs();
}

export async function loadPublicDocForRequest(slug: string): Promise<PublicDoc | null> {
  const decoded = decodeURIComponent(slug);
  const draft = await getDraftPreviewContext();
  if (draft.enabled && draft.branch) {
    const docs = await loadPublicDocsFromRef(draft.branch, draft.githubToken);
    return docs.find((d) => d.slug === decoded) ?? null;
  }
  return loadPublicDoc(slug);
}

export async function loadPublicWebClipsForRequest(): Promise<PublicWebClip[]> {
  const draft = await getDraftPreviewContext();
  if (draft.enabled && draft.branch) {
    return loadPublicWebClipsFromRef(draft.branch, draft.githubToken);
  }
  return loadPublicWebClips();
}

export async function loadPublicWebClipForRequest(slug: string): Promise<PublicWebClip | null> {
  const decoded = decodeURIComponent(slug);
  const draft = await getDraftPreviewContext();
  if (draft.enabled && draft.branch) {
    const clips = await loadPublicWebClipsFromRef(draft.branch, draft.githubToken);
    return clips.find((c) => c.slug === decoded) ?? null;
  }
  return loadPublicWebClip(slug);
}
