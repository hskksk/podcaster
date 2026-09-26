import { Calendar, Clock, ExternalLink } from "lucide-react";
import { formatReadingTime, readingTimeMinutes } from "../lib/site/reading-time";

function ArticleInsertIllustration(props: { src: string; title: string }) {
  return (
    <figure className="article-insert-figure not-prose">
      <img
        className="w-full rounded-lg border border-border/50 bg-muted/30 object-cover aspect-[3/2] sm:aspect-[16/10]"
        src={props.src}
        alt={`${props.title} の挿絵`}
        width={960}
        height={600}
        loading="eager"
        decoding="async"
      />
      <figcaption className="mt-2.5 text-center text-xs tracking-wide text-muted-fg">
        記事イメージ（AI生成）
      </figcaption>
    </figure>
  );
}

export function ArticleHeader(props: {
  title: string;
  date?: string;
  source?: string;
  mdocSource: string;
  /** Episode artwork from Supabase; shown as an article insert illustration. */
  coverImageUrl?: string;
}) {
  const minutes = readingTimeMinutes(props.mdocSource);
  const illustration = props.coverImageUrl?.trim();

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

  return (
    <header className="mb-10 border-b border-border/70 pb-8">
      {metaRow}
      <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">
        {props.title}
      </h1>
      {illustration ? (
        <div className="mt-8">
          <ArticleInsertIllustration src={illustration} title={props.title} />
        </div>
      ) : null}
      {props.source ? (
        <p className={illustration ? "mt-6 text-sm" : "mt-4 text-sm"}>
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
