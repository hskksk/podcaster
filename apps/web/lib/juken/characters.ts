export const CHARACTERS = [
  { name: "くまぴー", emoji: "🐻", tone: "kuma" },
  { name: "とらぴー", emoji: "🐯", tone: "tora" },
  { name: "ねこぴー", emoji: "🐱", tone: "neko" },
  { name: "きつぴー", emoji: "🦊", tone: "kitsu" },
] as const;

export type CharacterTone = (typeof CHARACTERS)[number]["tone"];

export function characterByName(name: string) {
  return CHARACTERS.find((c) => c.name === name) ?? null;
}
