import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicDoc } from "../lib/site/docs";

export function ArticlePager(props: {
  prev: PublicDoc | null;
  next: PublicDoc | null;
  basePath?: string;
}) {
  const base = props.basePath ?? "/articles";
  if (!props.prev && !props.next) return null;

  return (
    <nav
      aria-label="前後の記事"
      className="mt-16 grid gap-4 border-t border-border/70 pt-10 sm:grid-cols-2"
    >
      {props.prev ? (
        <Link
          href={`${base}/${encodeURIComponent(props.prev.slug)}`}
          className="group flex flex-col rounded-[var(--radius-card)] border border-border bg-surface p-4 no-underline shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)]"
        >
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-fg">
            <ChevronLeft className="size-3.5" strokeWidth={1.75} />
            前の記事
          </span>
          <span className="mt-2 font-medium leading-snug text-fg group-hover:text-fg/90">
            {props.prev.title}
          </span>
        </Link>
      ) : (
        <div />
      )}
      {props.next ? (
        <Link
          href={`${base}/${encodeURIComponent(props.next.slug)}`}
          className="group flex flex-col rounded-[var(--radius-card)] border border-border bg-surface p-4 text-right no-underline shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)] sm:col-start-2"
        >
          <span className="inline-flex items-center justify-end gap-1 text-xs font-medium text-muted-fg">
            次の記事
            <ChevronRight className="size-3.5" strokeWidth={1.75} />
          </span>
          <span className="mt-2 font-medium leading-snug text-fg group-hover:text-fg/90">
            {props.next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
