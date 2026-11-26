import { eraLabel, eraTrackSpans } from "../../../lib/juken/history-map/eras";
import { yearStopIndex } from "../../../lib/juken/history-map/yearStops";

export function YearScrubber(props: {
  year: number;
  yearDisplay: string;
  yearStops: number[];
  onStep: (delta: number) => void;
  onChange: (year: number) => void;
  className?: string;
}) {
  const { year, yearDisplay, yearStops, onStep, onChange, className } = props;
  const maxIdx = Math.max(0, yearStops.length - 1);
  const idx = yearStops.length ? yearStopIndex(year, yearStops) : 0;
  const eraSpans = eraTrackSpans(yearStops);

  return (
    <div className={className ?? "hm-row"}>
      <button type="button" className="hm-btn" onClick={() => onStep(-1)} aria-label="前の出来事">
        ◀
      </button>
      <span className="hm-yr">{yearDisplay}</span>
      <button type="button" className="hm-btn" onClick={() => onStep(1)} aria-label="次の出来事">
        ▶
      </button>
      <div className="hm-yr-track-wrap">
        <div className="hm-yr-track" aria-hidden="true">
          {eraSpans.map((seg) => (
            <span
              key={seg.label}
              className="hm-yr-seg"
              style={{
                left: `${seg.leftPct}%`,
                width: `${seg.widthPct}%`,
                background: seg.color,
              }}
              title={seg.fullLabel}
            >
              {seg.widthPct >= 7 ? <span className="hm-yr-seg-lbl">{seg.label}</span> : null}
            </span>
          ))}
        </div>
        <input
          type="range"
          className="hm-yr-range"
          min={0}
          max={maxIdx}
          step={1}
          value={idx}
          aria-label="年"
          aria-valuetext={`${yearDisplay}、${eraLabel(year)}`}
          onChange={(e) => {
            const y = yearStops[Number(e.target.value)];
            if (y !== undefined) onChange(y);
          }}
        />
      </div>
    </div>
  );
}