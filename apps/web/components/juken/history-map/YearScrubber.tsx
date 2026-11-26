export function YearScrubber(props: {
  year: number;
  yearDisplay: string;
  min: number;
  max: number;
  onStep: (delta: number) => void;
  onChange: (year: number) => void;
  className?: string;
}) {
  const { year, yearDisplay, min, max, onStep, onChange, className } = props;
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
        min={min}
        max={max}
        step={1}
        value={year}
        aria-label="年"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
