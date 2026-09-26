import Link from "next/link";
import { BookOpen, Lock, Rss, Search } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader(props: {
  siteTitle: string;
  feedUrl: string;
  variant?: "public" | "clips";
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-surface/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="group flex min-w-0 flex-col gap-0.5 no-underline"
        >
          <span className="truncate font-serif text-base font-semibold tracking-tight text-fg group-hover:text-fg/90 sm:text-lg">
            {props.siteTitle}
          </span>
          <span className="hidden text-xs text-muted-fg sm:block">Wiki · Podcast</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1 sm:gap-2" aria-label="サイト">
          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium no-underline transition-colors",
              props.variant === "public"
                ? "bg-muted text-fg"
                : "text-muted-fg hover:bg-muted/80 hover:text-fg",
            )}
          >
            <BookOpen className="size-4 shrink-0 opacity-70" strokeWidth={1.75} />
            記事
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-fg no-underline transition-colors hover:bg-muted/80 hover:text-fg"
          >
            <Search className="size-4 shrink-0 opacity-70" strokeWidth={1.75} />
            <span className="hidden sm:inline">検索</span>
          </Link>
          <Link
            href="/web-clips"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium no-underline transition-colors",
              props.variant === "clips"
                ? "bg-muted text-fg"
                : "text-muted-fg hover:bg-muted/80 hover:text-fg",
            )}
          >
            <Lock className="size-4 shrink-0 opacity-70" strokeWidth={1.75} />
            Web Clips
          </Link>
          {props.feedUrl ? (
            <a
              href={props.feedUrl}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-accent no-underline transition-colors hover:bg-accent/10"
            >
              <Rss className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="hidden sm:inline">Podcast RSS</span>
              <span className="sm:hidden">RSS</span>
            </a>
          ) : null}
          <ThemeToggle className="ml-0.5 sm:ml-2" />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter(props: {
  siteTitle: string;
  articleCount: number;
  feedUrl: string;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted-fg sm:px-6">
        <p>
          {props.articleCount} 件 · © {year} {props.siteTitle}
        </p>
        {props.feedUrl ? (
          <a
            href={props.feedUrl}
            className="inline-flex items-center gap-1.5 text-muted-fg no-underline transition-colors hover:text-fg"
          >
            <Rss className="size-3.5" strokeWidth={1.75} />
            RSS
          </a>
        ) : null}
      </div>
    </footer>
  );
}

export function SiteShell(props: {
  siteTitle: string;
  feedUrl: string;
  articleCount: number;
  variant?: "public" | "clips";
  hero?: ReactNode;
  children: ReactNode;
  width?: "wide" | "article";
}) {
  const mainWidth =
    props.width === "article"
      ? "max-w-3xl"
      : props.width === "wide"
        ? "max-w-6xl"
        : "max-w-6xl";

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <SiteHeader
        siteTitle={props.siteTitle}
        feedUrl={props.feedUrl}
        variant={props.variant ?? "public"}
      />
      {props.hero}
      <main className={cn("mx-auto w-full flex-1 px-4 py-10 sm:px-6", mainWidth)}>
        {props.children}
      </main>
      <SiteFooter
        siteTitle={props.siteTitle}
        articleCount={props.articleCount}
        feedUrl={props.feedUrl}
      />
    </div>
  );
}
