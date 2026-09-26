"use client";

import type { TocEntry } from "../lib/site/toc";
import { cn } from "../lib/cn";

export function ArticleToc(props: { entries: TocEntry[] }) {
  if (props.entries.length < 2) return null;

  return (
    <nav
      aria-label="目次"
      className="rounded-xl border border-border bg-surface/80 p-4 text-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-fg">目次</p>
      <ol className="m-0 list-none space-y-2 p-0">
        {props.entries.map((e) => (
          <li key={e.id} className={cn(e.level === 3 && "pl-3")}>
            <a
              href={`#${e.id}`}
              className="leading-snug text-muted-fg no-underline transition-colors hover:text-fg"
            >
              {e.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
