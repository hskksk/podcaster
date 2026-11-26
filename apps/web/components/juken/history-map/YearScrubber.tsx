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
  return (
    <div className={className ?? "hm-row"}>
      <button type="button" className="hm-btn" onClick={() => onStep(-1)} aria-label="前の出来事">
        ◀
      </button>
      <span className="hm-yr">{yearDisplay}</span>
      <button type="button" className="hm-btn" onClick={() => onStep(1)} aria-label="次の出来事">
        ▶
      </button>
      <input
        type="range"
        min={0}
        max={maxIdx}
        step={1}
        value={idx}
        aria-label="年"
        aria-valuetext={yearDisplay}
        onChange={(e) => {
          const y = yearStops[Number(e.target.value)];
          if (y !== undefined) onChange(y);
        }}
      />
    </div>
  );
}