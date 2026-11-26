import { formatYear } from "./formatYear";
import type { HistoryEvent } from "./types";

export type QuizField = "y" | "t" | "who";

export function shuffleQuizFields(count: number): QuizField[] {
  const fields: QuizField[] = ["y", "t", "who"];
  return Array.from({ length: count }, () => fields[Math.floor(Math.random() * fields.length)]!);
}

export function fieldValue(event: HistoryEvent, field: QuizField): string {
  if (field === "y") return formatYear(event.year);
  if (field === "t") return event.title;
  return event.who;
}

export function maskFragments(event: HistoryEvent, field: QuizField): string[] {
  if (field === "y") return [formatYear(event.year)];
  if (field === "t") {
    const out = [event.title, ...event.title.split(/[()（）]/g)];
    const place = event.place.replace(/\(.*\)/, "");
    if (event.title.includes(place)) out.push(place);
    return [...new Set(out)].filter((s) => s.length >= 1);
  }
  return event.who
    .split(/[・()（）]/g)
    .flatMap((name) => {
      const k = name.replace(/(上皇|天皇|法皇)$/, "");
      const o = [name, k];
      if (/^[\u4e00-\u9fff]+$/.test(k)) {
        if (k.length === 3) o.push(k.slice(1));
        if (k.length === 4) o.push(k.slice(2));
      }
      return o;
    })
    .filter((x) => x.length >= 2);
}

export function maskText(event: HistoryEvent, text: string, quizMode: boolean, revealed: boolean, field: QuizField): string {
  if (!quizMode || revealed) return text;
  let out = text;
  const frags = [...new Set(maskFragments(event, field))].sort((a, b) => b.length - a.length);
  frags.forEach((s) => {
    out = out.split(s).join("？？？");
  });
  return out;
}