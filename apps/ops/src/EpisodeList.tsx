import type { BoardEpisode, Stage } from "../shared/types.ts";
import { formatJst } from "../shared/time.ts";

export function EpisodeList({
  episodes,
  selectedId,
  onSelect,
}: {
  episodes: BoardEpisode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (episodes.length === 0) {
    return <p className="empty">No episodes match this view.</p>;
  }
  return (
    <div>
      <div className="list-head">
        <span>Episode</span>
        <span>Script</span>
        <span>Audio</span>
        <span>Artwork</span>
        <span>Publish</span>
      </div>
      {episodes.map((episode) => {
        const alert = episode.failure?.reason ?? episode.stall;
        const tone = episode.failure ? "failed" : episode.stall ? "stalled" : "";
        return (
          <button
            key={episode.id}
            type="button"
            className={["row", episode.id === selectedId ? "selected" : "", tone].filter(Boolean).join(" ")}
            onClick={() => onSelect(episode.id)}
          >
            <span>
              <span className="title">{episode.title}</span>
              <span className="sub">
                {formatJst(episode.updatedAt)} · {episode.overviewStatus}
                {episode.scope ? ` · ${episode.scope}/${episode.trigger}` : ""}
                {episode.path ? ` · ${episode.path}` : ""}
              </span>
            </span>
            <StageMark stage={episode.stages.script} />
            <StageMark stage={episode.stages.audio} />
            <StageMark stage={episode.stages.artwork} />
            <StageMark stage={episode.stages.publish} />
            {alert ? <span className={`alert ${tone}`}>{alert}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function StageMark({ stage }: { stage: Stage }) {
  return (
    <span className="stage">
      <span className={`dot ${stage.kind}`} />
      {stage.label}
    </span>
  );
}
