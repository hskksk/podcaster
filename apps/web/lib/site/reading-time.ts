import { textify } from "../../../../scripts/lib/mdoc";

const CHARS_PER_MINUTE = 450;

export function readingTimeMinutes(source: string): number {
  const plain = textify(source).replace(/\s+/g, " ").trim();
  if (!plain) return 1;
  return Math.max(1, Math.round(plain.length / CHARS_PER_MINUTE));
}

export function formatReadingTime(minutes: number): string {
  return `約 ${minutes} 分`;
}
