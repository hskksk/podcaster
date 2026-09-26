import { Calendar, Clock, ExternalLink } from "lucide-react";
import { formatReadingTime, readingTimeMinutes } from "../lib/site/reading-time";

export function ArticleHeader(props: {
  title: string;
  date?: string;
  source?: string;
  mdocSource: string;
}) {
  const minutes = readingTimeMinutes(props.mdocSource);

  return (
    <header className="mb-10 border-b border-border/70 pb-8">
      {props.date ? (
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
      )}
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
    </header>
  );
}
