import { characterByName, type CharacterTone } from "./characters";

export type StoryBlock =
  | { type: "meta"; text: string }
  | { type: "list"; items: string[] }
  | { type: "heading"; text: string }
  | { type: "scene"; text: string }
  | { type: "rule" }
  | {
      type: "dialogue";
      speaker: string;
      emoji: string;
      tone: CharacterTone | "neutral";
      role: string;
      text: string;
      note: string;
    }
  | { type: "prose"; text: string };

const DIALOGUE =
  /^(?:(\p{Extended_Pictographic}\uFE0F?)\s*)?([^\s：（「]{1,24})(?:（([^）]+)）)?[：:]「([^」]*)」\s*(?:（([^）]*)）)?\s*$/u;

export function parseStory(source: string): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (!list) return;
    blocks.push({ type: "list", items: list });
    list = null;
  };

  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^---+$/.test(line)) {
      flush();
      blocks.push({ type: "rule" });
      continue;
    }
    if (/^#\s+/.test(line)) {
      flush();
      continue;
    }
    if (/^#{2,3}\s+/.test(line)) {
      flush();
      blocks.push({ type: "heading", text: line.replace(/^#{2,3}\s+/, "") });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const item = line.replace(/^[-*]\s+/, "");
      if (!list) list = [];
      list.push(item);
      continue;
    }
    flush();
    if (line.startsWith("**")) {
      blocks.push({ type: "meta", text: line });
      continue;
    }
    const dialogue = line.match(DIALOGUE);
    if (dialogue) {
      const speaker = dialogue[2] ?? "";
      const known = characterByName(speaker);
      blocks.push({
        type: "dialogue",
        speaker,
        emoji: dialogue[1] || known?.emoji || "💬",
        tone: known?.tone ?? "neutral",
        role: dialogue[3] ?? "",
        text: dialogue[4] ?? "",
        note: dialogue[5] ?? "",
      });
      continue;
    }
    if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**") && line.length > 2) {
      blocks.push({ type: "scene", text: line.slice(1, -1).trim() });
      continue;
    }
    blocks.push({ type: "prose", text: line });
  }
  flush();
  return blocks;
}

export function storyPlainText(blocks: StoryBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "dialogue") {
        return [block.speaker, block.role, block.text, block.note].filter(Boolean).join(" ");
      }
      if (block.type === "list") return block.items.join(" ");
      if (block.type === "rule") return "";
      if ("text" in block) return block.text.replace(/\*\*/g, "");
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function extractTextLabel(source: string): string {
  const match = source.match(/\*\*(?:今週のテキスト|テキスト)\*\*\s*([^\n｜|]+)/);
  return match?.[1]?.replace(/\*\*/g, "").trim() ?? "";
}

export function extractTodayLabel(source: string): string {
  const match = source.match(/\*\*今日\*\*\s*([^\n]+)/);
  return match?.[1]?.replace(/\*\*/g, "").trim() ?? "";
}
