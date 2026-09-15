export function PodcastPlayer(props: { episodeId?: string }) {
  if (!props.episodeId) return null;
  return <p className="markdoc-episode">Episode {props.episodeId}</p>;
}
