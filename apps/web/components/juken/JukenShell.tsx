import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { JUKEN_STORIES_HREF, jukenKokugoAvailable, jukenStoriesAvailable } from "../../lib/juken/hub";
import { historyMapAvailable } from "../../lib/juken/history-map/load";
import { drillIndexHref } from "../../lib/juken/kokugo-choice/load";
import { ThemeToggle } from "../ThemeToggle";
import { JukenAiNotice } from "./JukenAiNotice";

export function JukenCrumbs(props: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="階層" className="mb-6 text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {props.items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
            {index > 0 ? <span className="text-muted-fg" aria-hidden>/</span> : null}
            {item.href ? (
              <Link href={item.href} className="font-bold text-muted-fg no-underline hover:text-fg">
                {item.label}
              </Link>
            ) : (
              <span className="font-bold text-fg">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function JukenShell(props: {
  variant?: "home" | "stories" | "search" | "characters" | "drill" | "map";
  hero?: ReactNode;
  children: ReactNode;
  width?: "wide" | "story";
  /** On small screens, hide site chrome so a full-viewport tool can own the page. */
  immersive?: boolean;
}) {
  const year = new Date().getFullYear();
  const width = props.width === "story" ? "max-w-3xl" : "max-w-6xl";
  const showHistoryMap = historyMapAvailable();
  const showStories = jukenStoriesAvailable();
  const showKokugo = jukenKokugoAvailable();
  return (
    <div className={cn("juken flex min-h-screen flex-col", props.immersive && "juken-immersive")}>
      <header className="sticky top-0 z-50 border-b border-border/80 bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/juken" className="flex min-w-0 items-center gap-2.5 no-underline">
            <span className="j-stamp" aria-hidden>
              旅
            </span>
            <span className="min-w-0">
              <span className="block truncate font-serif text-lg font-black leading-none tracking-tight text-fg">
                ふしぎ旅
              </span>
              <span className="mt-1 block text-xs font-medium text-muted-fg">社会 · 国語</span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1" aria-label="ふしぎ旅">
            <Link
              href="/juken"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-bold no-underline",
                props.variant === "home" || props.variant === undefined
                  ? "bg-muted text-fg"
                  : "text-muted-fg hover:bg-muted hover:text-fg",
              )}
            >
              トップ
            </Link>
            {showStories ? (
              <Link
                href={JUKEN_STORIES_HREF}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-bold no-underline",
                  props.variant === "stories"
                    ? "bg-muted text-fg"
                    : "text-muted-fg hover:bg-muted hover:text-fg",
                )}
              >
                歴史ものがたり
              </Link>
            ) : null}
            {showHistoryMap ? (
              <Link
                href="/juken/history-map"
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-bold no-underline",
                  props.variant === "map"
                    ? "bg-muted text-fg"
                    : "text-muted-fg hover:bg-muted hover:text-fg",
                )}
              >
                歴史マップ
              </Link>
            ) : null}
            {showKokugo ? (
              <Link
                href={drillIndexHref()}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-bold no-underline",
                  props.variant === "drill"
                    ? "bg-muted text-fg"
                    : "text-muted-fg hover:bg-muted hover:text-fg",
                )}
              >
                国語
              </Link>
            ) : null}
            <Link
              href="/juken/characters"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-bold no-underline",
                props.variant === "characters"
                  ? "bg-muted text-fg"
                  : "text-muted-fg hover:bg-muted hover:text-fg",
              )}
            >
              ぬいぐるみ
            </Link>
            <Link
              href="/juken/search"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-bold no-underline",
                props.variant === "search"
                  ? "bg-muted text-fg"
                  : "text-muted-fg hover:bg-muted hover:text-fg",
              )}
            >
              さがす
            </Link>
            <Link
              href="/"
              className="rounded-full px-3 py-1.5 text-sm font-bold text-muted-fg no-underline hover:bg-muted hover:text-fg"
            >
              hskksk
            </Link>
            <ThemeToggle className="ml-1" />
          </nav>
        </div>
      </header>
      <div className={cn("juken-preamble mx-auto w-full px-4 pt-6 sm:px-6", width)}>
        <JukenAiNotice />
      </div>
      {props.hero}
      <main className={cn("mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10", width)}>{props.children}</main>
      <footer className="mt-auto border-t border-border/80 bg-surface/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-fg sm:px-6">
          <p>社会と国語の学習ハブです。</p>
          <p>© {year} ふしぎ旅</p>
        </div>
      </footer>
    </div>
  );
}
