import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Item = { href: string; title: string; weekdayLong: string };

export function JukenPager(props: { prev: Item | null; next: Item | null }) {
  if (!props.prev && !props.next) return null;
  return (
    <nav aria-label="前後の日" className="mt-12 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
      {props.prev ? (
        <Link
          href={props.prev.href}
          className="group flex flex-col rounded-[var(--radius-card)] border border-border bg-surface p-4 no-underline shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
        >
          <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-fg">
            <ChevronLeft className="size-3.5" strokeWidth={2} />
            前の日
          </span>
          <span className="mt-2 text-xs text-muted-fg">{props.prev.weekdayLong}</span>
          <span className="mt-1 font-bold leading-snug text-fg">{props.prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {props.next ? (
        <Link
          href={props.next.href}
          className="group flex flex-col rounded-[var(--radius-card)] border border-border bg-surface p-4 text-right no-underline shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] sm:col-start-2"
        >
          <span className="inline-flex items-center justify-end gap-1 text-xs font-bold text-muted-fg">
            次の日
            <ChevronRight className="size-3.5" strokeWidth={2} />
          </span>
          <span className="mt-2 text-xs text-muted-fg">{props.next.weekdayLong}</span>
          <span className="mt-1 font-bold leading-snug text-fg">{props.next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
