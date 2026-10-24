"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

export type JukenSearchItem = {
  href: string;
  title: string;
  weekday: string;
  courseTitle: string;
  weekLabel: string;
  text: string;
};

function snippet(text: string, needle: string): string {
  const hay = text.replace(/\s+/g, " ").trim();
  const at = hay.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return hay.slice(0, 90);
  const start = Math.max(0, at - 28);
  const end = Math.min(hay.length, at + needle.length + 56);
  return `${start > 0 ? "…" : ""}${hay.slice(start, end)}${end < hay.length ? "…" : ""}`;
}

export function JukenSearch(props: { items: JukenSearchItem[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return [];
    return props.items
      .filter((item) =>
        `${item.title}\n${item.weekday}\n${item.courseTitle}\n${item.weekLabel}\n${item.text}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 30);
  }, [needle, props.items]);

  return (
    <div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-fg"
          strokeWidth={2}
        />
        <input
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="ことばや人名"
          autoComplete="off"
          className="w-full rounded-2xl border border-border bg-surface py-3 pl-11 pr-4 text-base shadow-[var(--shadow-card)] placeholder:text-muted-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
      </div>
      {needle ? (
        <p className="mt-4 text-sm font-bold text-muted-fg">{results.length} 件</p>
      ) : (
        <p className="mt-4 text-sm text-muted-fg">物語の中のことばを入れます。</p>
      )}
      <ul className="mt-4 space-y-3">
        {results.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-[var(--radius-card)] border border-border bg-surface p-4 no-underline shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
            >
              <span className="text-xs font-bold text-accent">
                {item.courseTitle} · {item.weekLabel} · {item.weekday}
              </span>
              <span className="mt-1 block font-bold text-fg">{item.title}</span>
              <p className="mt-2 text-sm leading-relaxed text-muted-fg">{snippet(item.text, needle)}</p>
            </Link>
          </li>
        ))}
      </ul>
      {needle && results.length === 0 ? (
        <p className="mt-8 text-center text-sm font-bold text-muted-fg">見つかりませんでした。</p>
      ) : null}
    </div>
  );
}
