import Link from "next/link";
import { cn } from "../../lib/cn";

export function DayCards(props: {
  lessons: {
    href: string;
    day: string;
    weekdayLabel: string;
    weekdayLong: string;
    theme: string;
  }[];
  currentDay?: string;
  layout?: "grid" | "list";
}) {
  const list = props.layout === "list";
  return (
    <ol className={list ? "grid gap-2" : "grid gap-3 sm:grid-cols-5"}>
      {props.lessons.map((lesson) => {
        const current = lesson.day === props.currentDay;
        return (
          <li key={lesson.href}>
            <Link
              href={lesson.href}
              aria-current={current ? "page" : undefined}
              aria-label={`${lesson.weekdayLong} ${lesson.theme}`}
              className={cn(
                "j-day flex h-full items-start gap-3 rounded-[var(--radius-card)] border bg-surface p-3 no-underline shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
                list ? "items-center" : "sm:min-h-[8.5rem] sm:flex-col sm:p-4",
                current ? "border-accent ring-2 ring-accent/35" : "border-border",
              )}
            >
              <span className="j-stamp" aria-hidden>
                {lesson.weekdayLabel}
              </span>
              <span className="min-w-0 font-bold leading-snug text-fg">{lesson.theme}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
