"use client";

import Link from "next/link";
import { Headphones, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../lib/cn";

export type ArticleCard = {
  slug: string;
  title: string;
  date: string;
  audioUrl?: string;
};

export function ArticleSearch(props: {
  articles: ArticleCard[];
  basePath?: string;
  searchPlaceholder?: string;
}) {
  const basePath = props.basePath ?? "/articles";
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return props.articles;
    return props.articles.filter((a) => a.title.toLowerCase().includes(needle));
  }, [props.articles, q]);

  return (
    <>
      <div className="relative mb-6">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-fg"
          strokeWidth={1.75}
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={props.searchPlaceholder ?? "記事を検索…"}
          autoComplete="off"
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-fg shadow-sm transition-shadow placeholder:text-muted-fg focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/20 dark:focus:border-stone-500 dark:focus:ring-stone-500/20"
        />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <li key={a.slug}>
            <Link
              href={`${basePath}/${encodeURIComponent(a.slug)}`}
              className="group flex h-full flex-col rounded-[var(--radius-card)] border border-border bg-surface p-4 no-underline shadow-[var(--shadow-card)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
            >
              <time className="text-xs tabular-nums text-muted-fg">{a.date}</time>
              <span className="mt-2 flex-1 font-medium leading-snug text-fg group-hover:text-fg/90">
                {a.title}
              </span>
              {a.audioUrl ? (
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                  <Headphones className="size-3.5" strokeWidth={1.75} />
                  聴く
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && q.trim() ? (
        <p className="py-8 text-center text-sm text-muted-fg">該当する記事が見つかりませんでした。</p>
      ) : null}
    </>
  );
}

/** @deprecated use ArticleSearch filters in HomeArticleList */
export function ArticleFilterTabs(props: {
  value: string;
  onChange: (v: string) => void;
  counts: { all: number; audio: number; recent: number };
}) {
  const tabs = [
    { id: "all", label: "すべて", count: props.counts.all },
    { id: "audio", label: "音声あり", count: props.counts.audio },
    { id: "recent", label: "90日以内", count: props.counts.recent },
  ] as const;

  return (
    <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="記事フィルタ">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={props.value === tab.id}
          onClick={() => props.onChange(tab.id)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            props.value === tab.id
              ? "border-fg/20 bg-fg text-bg"
              : "border-border bg-surface text-muted-fg hover:border-fg/15 hover:text-fg",
          )}
        >
          {tab.label}
          <span className="ml-1.5 tabular-nums opacity-70">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}
