import type { PodcastConfig } from '../data/types.js';

/** Public object base for the `podcast` bucket (…/storage/v1/object/public/podcast). */
export function podcastStoragePublicBase(config: PodcastConfig[]): string | null {
  const coverUrl = config.find(c => c.key === 'podcast.cover_url')?.value;
  if (typeof coverUrl !== 'string' || !coverUrl.trim()) return null;
  const trimmed = coverUrl.trim();
  const lastSlash = trimmed.lastIndexOf('/');
  if (lastSlash <= 0) return null;
  return trimmed.slice(0, lastSlash);
}

export function isEpisodeImageEnabled(config: PodcastConfig[]): boolean {
  const raw = config.find(c => c.key === 'image.enabled')?.value;
  if (raw === false || raw === 'false') return false;
  return true;
}

export function episodeImagePublicUrl(
  imageUrl: string | null | undefined,
  config: PodcastConfig[]
): string | null {
  const path = imageUrl?.trim();
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = podcastStoragePublicBase(config);
  if (!base) return null;
  return `${base}/${path.replace(/^\//, '')}`;
}
