export const CHARACTERS = [
  { id: "kuma", name: "くまぴー", emoji: "🐻", tone: "kuma" },
  { id: "tora", name: "とらぴー", emoji: "🐯", tone: "tora" },
  { id: "neko", name: "ねこぴー", emoji: "🐱", tone: "neko" },
  { id: "kitsu", name: "きつぴー", emoji: "🦊", tone: "kitsu" },
  { id: "miju", name: "みじゅぴー", emoji: "🧃", tone: "miju" },
  { id: "ichi", name: "いちぴー", emoji: "🍓", tone: "ichi" },
  { id: "nasu", name: "なすぴー", emoji: "🍆", tone: "nasu" },
  { id: "tako", name: "たこぴー", emoji: "🐙", tone: "tako" },
  { id: "ramen", name: "らーぴー", emoji: "🍜", tone: "ramen" },
] as const;

export type CharacterId = (typeof CHARACTERS)[number]["id"];
export type CharacterTone = (typeof CHARACTERS)[number]["tone"];

export const CHARACTER_IDS: CharacterId[] = CHARACTERS.map((c) => c.id);

export function characterById(id: string) {
  return CHARACTERS.find((c) => c.id === id) ?? null;
}

export function characterByName(name: string) {
  return CHARACTERS.find((c) => c.name === name) ?? null;
}
