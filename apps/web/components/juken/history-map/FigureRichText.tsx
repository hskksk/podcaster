"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { segmentFigureText, type FigureIndex } from "../../../lib/juken/history-map/figures";
import type { HistoryFigure } from "../../../lib/juken/history-map/types";

type Props = {
  text: string;
  index: FigureIndex;
  className?: string;
};

function FigurePop({
  fig,
  open,
  id,
  style,
  fixed,
}: {
  fig: HistoryFigure;
  open: boolean;
  id: string;
  style?: CSSProperties;
  fixed?: boolean;
}) {
  if (!open) return null;
  return (
    <span className={`hm-fig-pop${fixed ? " hm-fig-pop--fixed" : ""}`} role="tooltip" id={id} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fig.imageUrl} alt={`${fig.name}の肖像`} width={200} height={200} loading="lazy" />
      <span className="hm-fig-cap">
        <span>{fig.name}</span>
        <span className="hm-mut">{fig.license}</span>
      </span>
    </span>
  );
}

const MOBILE_FIG_POP_MQ = "(max-width: 779px)";

function isMobileFigPop(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_FIG_POP_MQ).matches;
}

function FigureSpan({ label, fig }: { label: string; fig: HistoryFigure }) {
  const tipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const openedAtRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [fixedPop, setFixedPop] = useState<{ style: CSSProperties; fixed: boolean } | null>(null);

  const layoutPop = useCallback(() => {
    const el = anchorRef.current;
    if (!el || typeof window === "undefined") return;
    const useFixed = window.matchMedia(MOBILE_FIG_POP_MQ).matches;
    if (!useFixed) {
      setFixedPop(null);
      return;
    }
    const w = Math.min(220, window.innerWidth * 0.7);
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    const gap = 8;
    const estH = 260;
    const below = r.bottom + gap;
    const above = r.top - gap - estH;
    const tabReserve = 72;
    const preferBelow = below + estH < window.innerHeight - tabReserve;
    const top = preferBelow ? below : Math.max(8, above);
    setFixedPop({
      fixed: true,
      style: { left, top, width: w, bottom: "auto", transform: "none" },
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setFixedPop(null);
      return;
    }
    layoutPop();
  }, [open, layoutPop]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia(MOBILE_FIG_POP_MQ);
    if (!mq.matches) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (performance.now() - openedAtRef.current < 450) return;
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", layoutPop);
    window.addEventListener("scroll", layoutPop, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", layoutPop);
      window.removeEventListener("scroll", layoutPop, true);
    };
  }, [open, layoutPop]);

  const show = () => {
    if (isMobileFigPop()) return;
    setOpen(true);
  };
  const hide = () => {
    if (isMobileFigPop()) return;
    setOpen(false);
  };
  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next) openedAtRef.current = performance.now();
      return next;
    });
  };

  return (
    <span
      ref={anchorRef}
      className="hm-fig"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(e) => {
        if (isMobileFigPop()) return;
        const next = e.relatedTarget as Node | null;
        if (next && anchorRef.current?.contains(next)) return;
        hide();
      }}
      onClick={(e) => {
        if (!isMobileFigPop()) return;
        e.stopPropagation();
        e.preventDefault();
        toggleOpen();
      }}
      tabIndex={0}
      aria-describedby={open ? tipId : undefined}
    >
      {label}
      <FigurePop fig={fig} open={open} id={tipId} style={fixedPop?.style} fixed={fixedPop?.fixed} />
    </span>
  );
}

export function FigureRichText({ text, index, className }: Props) {
  const segments = segmentFigureText(text, index);
  if (segments.length === 1 && !segments[0]!.figure) {
    return <span className={className}>{text}</span>;
  }
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.figure ? (
          <FigureSpan key={`${i}-${seg.text}`} label={seg.text} fig={seg.figure} />
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

export function FigurePortrait({ fig, accent }: { fig: HistoryFigure; accent?: string }) {
  return (
    <div className="hm-av hm-av-img" style={accent ? { borderColor: accent } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fig.imageUrl} alt={fig.name} />
    </div>
  );
}