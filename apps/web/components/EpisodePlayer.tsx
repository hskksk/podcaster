"use client";

import { Headphones, Gauge } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../lib/cn";

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function EpisodePlayer(props: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState(1);

  function onRateChange(next: number) {
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-stone-50/50 p-4 dark:border-amber-900/50 dark:from-amber-950/30 dark:to-stone-950/20",
        props.className,
      )}
    >
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
        <Headphones className="size-4" strokeWidth={1.75} />
        このエピソードを聴く
      </p>
      <audio ref={audioRef} controls preload="metadata" src={props.src} className="w-full" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-fg">
          <Gauge className="size-3.5" strokeWidth={1.75} />
          速度
        </span>
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onRateChange(r)}
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium tabular-nums transition-colors",
              rate === r
                ? "bg-accent text-accent-fg"
                : "bg-surface text-muted-fg hover:text-fg",
            )}
          >
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}
