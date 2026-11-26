import Link from "next/link";
import { Map, ScrollText, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import {
  JUKEN_STORIES_HREF,
  jukenKokugoAvailable,
  jukenStoriesAvailable,
  loadHistoryMapTeaser,
} from "../../lib/juken/hub";
import { drillIndexHref } from "../../lib/juken/kokugo-choice/load";
import { cn } from "../../lib/cn";

function NavCard(props: {
  href: string;
  title: string;
  description: string;
  stamp: string;
  icon: ReactNode;
  density: "compact" | "full";
}) {
  return (
    <Link
      href={props.href}
      className={cn(
        "group flex h-full flex-col rounded-[var(--radius-card)] border border-border bg-surface no-underline shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
        props.density === "compact" ? "gap-2 p-4" : "gap-3 p-5 sm:p-6",
      )}
    >
      <span className="flex items-center gap-2">
        <span className="j-stamp" aria-hidden>
          {props.stamp}
        </span>
        <span
          className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-accent"
          aria-hidden
        >
          {props.icon}
        </span>
      </span>
      <span
        className={cn(
          "font-serif font-black tracking-tight text-fg group-hover:underline",
          props.density === "compact" ? "text-lg" : "text-xl sm:text-2xl",
        )}
      >
        {props.title}
      </span>
      <span className="text-sm leading-relaxed text-muted-fg">{props.description}</span>
    </Link>
  );
}

function SubjectBlock(props: {
  title: string;
  density: "compact" | "full";
  children: ReactNode;
}) {
  return (
    <section>
      <h3
        className={cn(
          "font-black tracking-[0.14em] text-muted-fg",
          props.density === "compact" ? "text-[0.65rem]" : "text-xs",
        )}
      >
        {props.title}
      </h3>
      <div
        className={cn(
          "mt-2 grid gap-3",
          props.density === "full" ? "sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
        )}
      >
        {props.children}
      </div>
    </section>
  );
}

export function JukenSubjectGrid(props: { density?: "compact" | "full" }) {
  const density = props.density ?? "full";
  const showStories = jukenStoriesAvailable();
  const showKokugo = jukenKokugoAvailable();
  const historyMap = loadHistoryMapTeaser();
  const showSocial = showStories || Boolean(historyMap);

  if (!showSocial && !showKokugo) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-4 py-8 text-center text-sm font-bold text-muted-fg">
        まだコンテンツがありません。
      </p>
    );
  }

  return (
    <div className={cn("grid gap-5", density === "full" && "sm:gap-6")}>
      {showSocial ? (
        <SubjectBlock title="社会" density={density}>
          {showStories ? (
            <NavCard
              href={JUKEN_STORIES_HREF}
              title="歴史ものがたり"
              description="ぬいぐるみたちが、週のテキストを会話で歩く読み物です。"
              stamp="話"
              icon={<ScrollText className="size-4" strokeWidth={2} />}
              density={density}
            />
          ) : null}
          {historyMap ? (
            <NavCard
              href={historyMap.href}
              title="歴史マップ"
              description={historyMap.subtitle}
              stamp="地"
              icon={<Map className="size-4" strokeWidth={2} />}
              density={density}
            />
          ) : null}
        </SubjectBlock>
      ) : null}

      {showKokugo ? (
        <SubjectBlock title="国語" density={density}>
          <NavCard
            href={drillIndexHref()}
            title="選択肢問題"
            description="短い文章を読んで、まちがいの選択肢を消していく練習です。"
            stamp="国"
            icon={<Sparkles className="size-4" strokeWidth={2} />}
            density={density}
          />
        </SubjectBlock>
      ) : null}
    </div>
  );
}