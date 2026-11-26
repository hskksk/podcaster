import "server-only";

import { courseKicker, formatWeekLabel, loadJukenCourses, type JukenCourse, type JukenWeek } from "./catalog";
import { historyMapAvailable, loadHistoryMapBundle } from "./history-map/load";
import { loadKokugoChoiceSets } from "./kokugo-choice/catalog";
import type { DrillSet } from "./kokugo-choice/load";

export type JukenStoryHighlight = {
  course: JukenCourse;
  week: JukenWeek;
};

export type JukenHistoryMapTeaser = {
  href: "/juken/history-map";
  title: string;
  subtitle: string;
  eventCount: number;
  yearMin: number;
  yearMax: number;
};

export function recentStoryHighlights(limit = 3): JukenStoryHighlight[] {
  return loadJukenCourses()
    .flatMap((course) => course.weeks.map((week) => ({ course, week })))
    .sort((a, b) => b.week.week.localeCompare(a.week.week))
    .slice(0, limit);
}

export function recentKokugoSets(limit = 3): DrillSet[] {
  return loadKokugoChoiceSets()
    .slice()
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, limit);
}

export function loadHistoryMapTeaser(): JukenHistoryMapTeaser | null {
  if (!historyMapAvailable()) return null;
  const bundle = loadHistoryMapBundle();
  if (!bundle) return null;
  return {
    href: "/juken/history-map",
    title: bundle.meta.title,
    subtitle: bundle.meta.subtitle,
    eventCount: bundle.events.length,
    yearMin: bundle.meta.yearMin,
    yearMax: bundle.meta.yearMax,
  };
}

export function storyHighlightKicker({ course, week }: JukenStoryHighlight): string {
  const parts = [courseKicker(course) || course.title, formatWeekLabel(week.week)];
  if (week.textLabel) parts.push(week.textLabel);
  return parts.filter(Boolean).join(" · ");
}