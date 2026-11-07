import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

type Direction = "row" | "column";

type SplitProps = {
  direction: Direction;
  storageKey: string;
  initialRatio: number;
  minFirst: number;
  minSecond: number;
  collapsed?: boolean;
  first: ReactNode;
  second: ReactNode;
};

export function Split({
  direction,
  storageKey,
  initialRatio,
  minFirst,
  minSecond,
  collapsed = false,
  first,
  second,
}: SplitProps) {
  const [ratio, setRatio] = useState(() => readRatio(storageKey, initialRatio));
  const ratioRef = useRef(ratio);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef(false);

  useEffect(() => {
    ratioRef.current = ratio;
  }, [ratio]);

  function applyPointer(client: number) {
    const bounds = frame.current?.getBoundingClientRect();
    if (!bounds) return;
    const total = direction === "row" ? bounds.width : bounds.height;
    const origin = direction === "row" ? bounds.left : bounds.top;
    const available = total - 5;
    const limit = available <= minFirst + minSecond
      ? available / 2
      : Math.min(Math.max(client - origin, minFirst), available - minSecond);
    const next = available <= 0 ? initialRatio : limit / available;
    ratioRef.current = next;
    setRatio(next);
  }

  function finish() {
    drag.current = false;
    localStorage.setItem(storageKey, String(ratioRef.current));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    drag.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    applyPointer(direction === "row" ? event.clientX : event.clientY);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.08 : 0.02;
    const delta = direction === "row"
      ? (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0)
      : (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0);
    if (!delta) return;
    event.preventDefault();
    const next = Math.min(0.85, Math.max(0.15, ratioRef.current + delta));
    ratioRef.current = next;
    setRatio(next);
    localStorage.setItem(storageKey, String(next));
  }

  const folded = collapsed && direction === "column";
  const size = `calc((100% - 5px) * ${ratio})`;
  const firstStyle = folded
    ? { flex: "1 1 auto", minHeight: 0 }
    : direction === "row"
      ? { width: size, flex: "0 0 auto" }
      : { height: size, flex: "0 0 auto" };

  return (
    <div ref={frame} className={`split split-${direction}${folded ? " collapsed" : ""}`}>
      <div className="pane" style={firstStyle}>{first}</div>
      {folded ? null : (
        <div
          className="gutter"
          role="separator"
          aria-orientation={direction === "row" ? "vertical" : "horizontal"}
          aria-valuemin={15}
          aria-valuemax={85}
          aria-valuenow={Math.round(ratio * 100)}
          aria-label="Resize panels"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onDoubleClick={() => {
            ratioRef.current = initialRatio;
            setRatio(initialRatio);
            localStorage.setItem(storageKey, String(initialRatio));
          }}
          onKeyDown={onKeyDown}
        />
      )}
      <div className={folded ? "pane pane-bar" : "pane pane-fill"}>{second}</div>
    </div>
  );
}

function readRatio(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  const value = raw == null ? fallback : Number(raw);
  return Number.isFinite(value) && value > 0.1 && value < 0.9 ? value : fallback;
}
