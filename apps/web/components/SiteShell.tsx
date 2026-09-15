import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader(props: { siteTitle: string; feedUrl: string }) {
  return (
    <header className="site-header">
      <Link href="/" className="site-title">
        {props.siteTitle}
      </Link>
      <nav className="site-nav">
        <Link href="/web-clips">Web Clips</Link>
      </nav>
      {props.feedUrl ? (
        <a className="rss-link" href={props.feedUrl}>
          📻 Podcast RSS
        </a>
      ) : null}
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
    <footer className="site-footer">
      <span>
        {props.feedUrl ? (
          <>
            <a href={props.feedUrl}>📻 RSS</a>
            {" · "}
          </>
        ) : null}
        {props.articleCount} articles · © {year} {props.siteTitle}
      </span>
    </footer>
  );
}

export function SiteShell(props: {
  siteTitle: string;
  feedUrl: string;
  articleCount: number;
  hero?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader siteTitle={props.siteTitle} feedUrl={props.feedUrl} />
      {props.hero}
      <main>{props.children}</main>
      <SiteFooter
        siteTitle={props.siteTitle}
        articleCount={props.articleCount}
        feedUrl={props.feedUrl}
      />
    </>
  );
}
