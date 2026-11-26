import { useRef, type PointerEvent, type ReactNode } from "react";
import type { SheetSize } from "./types";

export function MobileSheet(props: { sheet: SheetSize; onSheet: (next: SheetSize) => void; children: ReactNode }) {
  const { sheet, onSheet, children } = props;
  const y0 = useRef<number | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    y0.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (y0.current == null) return;
    const d = e.clientY - y0.current;
    y0.current = null;
    onSheet(d < -20 ? "h" : d > 20 ? "p" : sheet === "h" ? "p" : "h");
  };

  return (
    <div className="hm-sheet">
      <button
        type="button"
        className="hm-grab"
        aria-expanded={sheet === "h"}
        aria-controls="hm-sheet-body"
        aria-label={sheet === "h" ? "詳細をしまう" : "詳細を広げる"}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          y0.current = null;
        }}
      >
        <i />
      </button>
      <div
        className="hm-sheet-body"
        id="hm-sheet-body"
        onClick={(e) => {
          if (sheet !== "p") return;
          const target = e.target as HTMLElement;
          if (target.closest("button, a")) return;
          onSheet("h");
        }}
      >
        {children}
      </div>
    </div>
  );
}
