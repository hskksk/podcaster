import type { HistoryAxis } from "../../../lib/juken/history-map/types";

export type AxisView = "a" | "sw" | HistoryAxis;

const ALL_AXES: HistoryAxis[] = ["s", "w", "r", "c", "e"];

export function axesForView(view: AxisView): Set<HistoryAxis> {
  if (view === "a") return new Set(ALL_AXES);
  if (view === "sw") return new Set(["s", "w"]);
  return new Set([view]);
}

export type AxisButton = { id: AxisView; label: string; color: string };

export function HistoryMapFilters(props: {
  level: number;
  levelLabels: string[];
  onLevel: (level: number) => void;
  axisButtons: AxisButton[];
  axisView: AxisView;
  onAxis: (view: AxisView) => void;
}) {
  const { level, levelLabels, onLevel, axisButtons, axisView, onAxis } = props;
  return (
    <>
      <div className="hm-row">
        <span className="hm-mut">階層</span>
        {levelLabels.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`hm-btn${level === i + 1 ? " on" : ""}`}
            onClick={() => onLevel(i + 1)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="hm-row">
        <span className="hm-mut">軸</span>
        {axisButtons.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`hm-btn${axisView === b.id ? " on" : ""}`}
            style={axisView === b.id ? { background: b.color, borderColor: b.color, color: "#fff" } : undefined}
            onClick={() => onAxis(b.id)}
          >
            {b.label}
          </button>
        ))}
        {axisView === "a" || axisView === "sw" ? (
          <span className="hm-mut">
            <span style={{ color: "#2f6fb5" }}>●</span>政治　<span style={{ color: "#c23b3b" }}>●</span>戦い
          </span>
        ) : null}
      </div>
    </>
  );
}

export function RegionLegend(props: { items: { name: string; color: string }[] }) {
  return (
    <div className="hm-legend hm-mut" aria-label="五畿七道の色分け">
      {props.items.map((r) => (
        <span key={r.name} className="hm-legend-i">
          <span className="hm-legend-swatch" style={{ background: r.color }} aria-hidden />
          {r.name}
        </span>
      ))}
    </div>
  );
}
