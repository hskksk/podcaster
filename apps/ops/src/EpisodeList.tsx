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
        <ColumnMark name="Script" glyph="📝" />
        <ColumnMark name="Audio" glyph="🔊" />
        <ColumnMark name="Artwork" glyph="🎨" />
        <ColumnMark name="Publish" glyph="📮" />
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
            <StageMark name="Script" stage={episode.stages.script} />
            <StageMark name="Audio" stage={episode.stages.audio} />
            <StageMark name="Artwork" stage={episode.stages.artwork} />
            <StageMark name="Publish" stage={episode.stages.publish} />
            {alert ? <span className={`alert ${tone}`}>{alert}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function ColumnMark({ name, glyph }: { name: string; glyph: string }) {
  return <span className="col-mark" title={name} aria-label={name}>{glyph}</span>;
}

export function StageMark({ name, stage }: { name: string; stage: Stage }) {
  const tip = stage.detail ? `${name}: ${stage.label} — ${stage.detail}` : `${name}: ${stage.label}`;
  return (
    <span className={`mark ${stage.kind}`} title={tip} aria-label={tip}>
      {glyphFor(stage)}
    </span>
  );
}

function glyphFor(stage: Stage): string {
  switch (stage.kind) {
    case "done":
      return "✅";
    case "live":
      return "🟢";
    case "failed":
      return "❌";
    case "running":
      return "🔄";
    case "waiting":
      return "⏳";
    case "reused":
      return "♻️";
    case "off":
      return "🚫";
    default:
      if (stage.label === "Unpublished") return "📤";
      if (stage.label === "No artwork") return "🖼️";
      return "⚪";
  }
}
