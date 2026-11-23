import type { PublicWebClip } from "./web-clips";
import { loadPublicWebClips } from "./web-clips";

export function adjacentWebClips(slug: string): {
  prev: PublicWebClip | null;
  next: PublicWebClip | null;
} {
  const clips = loadPublicWebClips();
  const i = clips.findIndex((c) => c.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? clips[i - 1]! : null,
    next: i < clips.length - 1 ? clips[i + 1]! : null,
  };
}
