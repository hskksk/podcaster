import { eraLabel, eraTrackSpans } from "../../../lib/juken/history-map/eras";
import { formatYear } from "../../../lib/juken/history-map/formatYear";
import { yearStopIndex } from "../../../lib/juken/history-map/yearStops";

function EraVerticalLabel(props: { text: string }) {
  return (
    <span className="hm-yr-seg-lbl">
      {Array.from(props.text).map((ch, i) => (
        <span key={i} className="hm-yr-seg-ch">
          {ch}
        </span>
      ))}
    </span>
  );
}

export function YearScrubber(props: {
  year: number;
  yearStops: number[];
  onStep: (delta: number) => void;
  onChange: (year: number) => void;
  /** Screen reader label for the current year (e.g. quiz masking). */
  yearAriaText?: string;
  className?: string;
}) {
  const { year, yearStops, onStep, onChange, yearAriaText, className } = props;
  const maxIdx = Math.max(0, yearStops.length - 1);
  const idx = yearStops.length ? yearStopIndex(year, yearStops) : 0;
  const eraSpans = eraTrackSpans(yearStops);
  const ariaYear = yearAriaText ?? formatYear(year);

  return (
    <div className={className ?? "hm-yr-scrub"}>
      <button type="button" className="hm-btn hm-yr-step" onClick={() => onStep(-1)} aria-label="前の出来事">
        ◀
      </button>
      <div className="hm-yr-track-wrap">
        <div className="hm-yr-track" aria-hidden="true">
          {eraSpans.map((seg) => (
            <span
              key={`${seg.label}-${seg.leftPct.toFixed(2)}`}
              className="hm-yr-seg"
              style={{
                left: `${seg.leftPct}%`,
                width: `${seg.widthPct}%`,
                background: seg.color,
              }}
              title={seg.fullLabel}
            >
              {seg.widthPct >= 2.8 ? <EraVerticalLabel text={seg.label} /> : null}
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
          aria-valuetext={`${ariaYear}、${eraLabel(year)}`}
          onChange={(e) => {
            const y = yearStops[Number(e.target.value)];
            if (y !== undefined) onChange(y);
          }}
        />
      </div>
      <button type="button" className="hm-btn hm-yr-step" onClick={() => onStep(1)} aria-label="次の出来事">
        ▶
      </button>
    </div>
  );
}