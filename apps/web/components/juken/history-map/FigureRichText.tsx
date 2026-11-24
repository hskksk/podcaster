"use client";

import { useId, useState } from "react";
import { segmentFigureText, type FigureIndex } from "../../../lib/juken/history-map/figures";
import type { HistoryFigure } from "../../../lib/juken/history-map/types";

type Props = {
  text: string;
  index: FigureIndex;
  className?: string;
};

function FigurePop({ fig, open, id }: { fig: HistoryFigure; open: boolean; id: string }) {
  if (!open) return null;
  return (
    <span className="hm-fig-pop" role="tooltip" id={id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fig.imageUrl} alt={`${fig.name}の肖像`} width={200} height={200} loading="lazy" />
      <span className="hm-fig-cap">
        <span>{fig.name}</span>
        <span className="hm-mut">{fig.license}</span>
      </span>
    </span>
  );
}

function FigureSpan({ label, fig }: { label: string; fig: HistoryFigure }) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  return (
    <span
      className="hm-fig"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
      aria-describedby={open ? tipId : undefined}
    >
      {label}
      <FigurePop fig={fig} open={open} id={tipId} />
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