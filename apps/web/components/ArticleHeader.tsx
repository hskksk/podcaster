import { Calendar, Clock, ExternalLink } from "lucide-react";
import { formatReadingTime, readingTimeMinutes } from "../lib/site/reading-time";

function EpisodeCoverArt(props: { src: string; title: string }) {
  return (
    <img
      className="size-36 shrink-0 rounded-2xl object-cover shadow-[var(--shadow-card-hover)] ring-1 ring-border/80 sm:size-40 md:size-44"
      src={props.src}
      alt={`${props.title} のエピソードカバー`}
      width={176}
      height={176}
    />
  );
}

export function ArticleHeader(props: {
  title: string;
  date?: string;
  source?: string;
  mdocSource: string;
  /** 1:1 episode artwork from Supabase when available. */
  coverImageUrl?: string;
}) {
  const minutes = readingTimeMinutes(props.mdocSource);
  const cover = props.coverImageUrl?.trim();

  const metaRow = props.date ? (
    <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-fg">
      <span className="inline-flex items-center gap-1.5">
        <Calendar className="size-3.5" strokeWidth={1.75} />
        {props.date}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock className="size-3.5" strokeWidth={1.75} />
        {formatReadingTime(minutes)}
      </span>
    </p>
  ) : (
    <p className="mb-3 flex items-center gap-1.5 text-sm text-muted-fg">
      <Clock className="size-3.5" strokeWidth={1.75} />
      {formatReadingTime(minutes)}
    </p>
  );

  const titleBlock = (
    <>
      <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">
        {props.title}
      </h1>
      {props.source ? (
        <p className="mt-4 text-sm">
          <a
            href={props.source}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-muted-fg no-underline hover:text-fg"
          >
            <ExternalLink className="size-3.5" strokeWidth={1.75} />
            元記事
          </a>
        </p>
      ) : null}
    </>
  );

  return (
    <header className="mb-10 border-b border-border/70 pb-8">
      {metaRow}
      {cover ? (
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">
          <div className="order-1 shrink-0 md:order-2">
            <EpisodeCoverArt src={cover} title={props.title} />
          </div>
          <div className="order-2 min-w-0 flex-1 md:order-1">{titleBlock}</div>
        </div>
      ) : (
        titleBlock
      )}
    </header>
  );
}
