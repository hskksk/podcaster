import Link from "next/link";
import { Map, ScrollText, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import {
  loadHistoryMapTeaser,
  recentKokugoSets,
  recentStoryHighlights,
  storyHighlightKicker,
} from "../../lib/juken/hub";
import { drillIndexHref } from "../../lib/juken/kokugo-choice/load";
import { cn } from "../../lib/cn";
import { DayCards } from "./DayCards";

const laneHead =
  "text-xs font-black tracking-[0.14em] text-muted-fg";

function LaneShell(props: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  icon: ReactNode;
  density: "compact" | "full";
  children: React.ReactNode;
}) {
  return (
    <section
      id={props.id}
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]",
        props.density === "compact" ? "p-4" : "p-5 sm:p-6",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black tracking-[0.14em] text-accent">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-accent" aria-hidden>
              {props.icon}
            </span>
            {props.eyebrow}
          </p>
          <h3
            className={cn(
              "mt-2 font-serif font-black tracking-tight text-fg",
              props.density === "compact" ? "text-xl" : "text-2xl",
            )}
          >
            {props.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-fg">{props.description}</p>
        </div>
        <Link
          href={props.href}
          className="shrink-0 rounded-full border border-border bg-bg px-4 py-2 text-sm font-black text-link no-underline transition hover:bg-muted"
        >
          {props.linkLabel}
        </Link>
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

export function JukenContentLanes(props: { density?: "compact" | "full"; storyLimit?: number; kokugoLimit?: number }) {
  const density = props.density ?? "full";
  const stories = recentStoryHighlights(props.storyLimit ?? (density === "compact" ? 1 : 3));
  const kokugo = recentKokugoSets(props.kokugoLimit ?? (density === "compact" ? 2 : 3));
  const historyMap = loadHistoryMapTeaser();

  return (
    <div className={cn("grid gap-4", density === "full" && "lg:gap-5")}>
      {stories.length > 0 ? (
        <LaneShell
          id="stories"
          eyebrow="物語"
          title="週次ものがたり"
          description="ぬいぐるみたちが、週のテキストを会話で歩く中学受験向けの読み物です。"
          href="/juken#stories"
          linkLabel="物語一覧"
          icon={<ScrollText className="size-4" strokeWidth={2} />}
          density={density}
        >
          <p className={laneHead}>新着</p>
          <ul className="mt-3 space-y-4">
            {stories.map((item) => (
              <li key={item.week.href}>
                <p className="text-sm font-bold text-muted-fg">{storyHighlightKicker(item)}</p>
                <div className="mt-2">
                  <DayCards lessons={item.week.lessons} layout={density === "compact" ? "list" : "grid"} />
                </div>
              </li>
            ))}
          </ul>
        </LaneShell>
      ) : null}

      {historyMap ? (
        <LaneShell
          id="history-map"
          eyebrow="地図"
          title={historyMap.title}
          description={historyMap.subtitle}
          href={historyMap.href}
          linkLabel="歴史マップを開く"
          icon={<Map className="size-4" strokeWidth={2} />}
          density={density}
        >
          <p className={laneHead}>新着</p>
          <Link
            href={historyMap.href}
            className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-bg px-4 py-3 no-underline transition hover:bg-muted"
          >
            <span className="j-stamp" aria-hidden>
              史
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-bold text-fg">
                出来事 {historyMap.eventCount} 件 · 西暦 {historyMap.yearMin}–{historyMap.yearMax}
              </span>
              <span className="mt-0.5 block text-muted-fg">地図と年表で、年代と場所からたどる</span>
            </span>
          </Link>
        </LaneShell>
      ) : null}

      {kokugo.length > 0 ? (
        <LaneShell
          id="kokugo"
          eyebrow="国語"
          title="国語 選択肢問題"
          description="短い文章を読んで、まちがいの選択肢を消していく練習です。"
          href={drillIndexHref()}
          linkLabel="問題一覧"
          icon={<Sparkles className="size-4" strokeWidth={2} />}
          density={density}
        >
          <p className={laneHead}>新着セット</p>
          <ul className="mt-3 space-y-2">
            {kokugo.map((set) => (
              <li key={set.id}>
                <Link
                  href={set.href}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-border bg-bg px-3 py-2.5 no-underline transition hover:bg-muted"
                >
                  <span className="font-bold text-fg">{set.title}</span>
                  <span className="text-sm font-bold text-muted-fg">{set.questions.length} 問</span>
                </Link>
              </li>
            ))}
          </ul>
        </LaneShell>
      ) : null}
    </div>
  );
}