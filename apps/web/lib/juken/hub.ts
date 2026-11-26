import "server-only";

import { loadJukenCourses } from "./catalog";
import { historyMapAvailable, loadHistoryMapBundle } from "./history-map/load";
import { loadKokugoChoiceSets } from "./kokugo-choice/catalog";

export type JukenHistoryMapTeaser = {
  href: "/juken/history-map";
  title: string;
  subtitle: string;
};

export const JUKEN_STORIES_HREF = "/juken/stories";

export function jukenStoriesAvailable(): boolean {
  return loadJukenCourses().some((course) => course.weeks.length > 0);
}

export function jukenKokugoAvailable(): boolean {
  try {
    return loadKokugoChoiceSets().length > 0;
  } catch {
    return false;
  }
}

export function loadHistoryMapTeaser(): JukenHistoryMapTeaser | null {
  if (!historyMapAvailable()) return null;
  const bundle = loadHistoryMapBundle();
  if (!bundle) return null;
  return {
    href: "/juken/history-map",
    title: bundle.meta.title,
    subtitle: bundle.meta.subtitle,
  };
}