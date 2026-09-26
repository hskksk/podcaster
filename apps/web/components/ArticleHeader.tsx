import { Calendar, Clock, ExternalLink } from "lucide-react";
import { formatReadingTime, readingTimeMinutes } from "../lib/site/reading-time";

/** Viewport-wide hero (note.com-style) from a 1:1 episode artwork source. */
function EpisodeCoverHero(props: { src: string; title: string }) {
  return (
    <figure className="relative left-1/2 mb-8 w-screen max-w-[100vw] -translate-x-1/2">
      <div className="overflow-hidden bg-muted">
        <img
          className="h-[min(56vw,420px)] w-full object-cover object-center sm:h-[380px] md:h-[440px]"
          src={props.src}
          alt={`${props.title} のエピソードカバー`}
          width={1200}
          height={630}
          fetchPriority="high"
        />
      </div>
    </figure>
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
    <header className="mb-10">
      {cover ? <EpisodeCoverHero src={cover} title={props.title} /> : null}
      <div className="border-b border-border/70 pb-8">
        {metaRow}
        {titleBlock}
      </div>
    </header>
  );
}
