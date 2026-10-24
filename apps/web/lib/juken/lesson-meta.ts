import yaml from "js-yaml";
import type { CharacterId } from "./characters";
import { CHARACTER_IDS } from "./characters";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export type LessonMode = "observation" | "roleplay";

export type WeekOutlineEntry = {
  day: string;
  theme: string;
  mode: LessonMode;
  roles?: string;
};

export type LessonCast = Partial<Record<CharacterId, string>>;

export type LessonFrontmatter = {
  sapixText: string;
  unit: string;
  focus?: string;
  cast: LessonCast;
  weekOutline?: WeekOutlineEntry[];
};

export type ParsedLessonFile = {
  frontmatter: LessonFrontmatter;
  body: string;
};

function clean(text: string): string {
  return text.replace(/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

function readString(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return clean(String(value));
  return typeof value === "string" ? clean(value) : "";
}

function parseCast(raw: unknown): LessonCast {
  if (!raw || typeof raw !== "object") return {};
  const cast: LessonCast = {};
  for (const id of CHARACTER_IDS) {
    const role = readString((raw as Record<string, unknown>)[id]);
    if (role) cast[id] = role;
  }
  return cast;
}

function parseWeekOutline(raw: unknown): WeekOutlineEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const entries: WeekOutlineEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const day = readString(record.day);
    const theme = readString(record.theme);
    const modeRaw = readString(record.mode);
    const mode: LessonMode = modeRaw === "roleplay" ? "roleplay" : "observation";
    const roles = readString(record.roles);
    if (!day || !theme) continue;
    entries.push(roles ? { day, theme, mode, roles } : { day, theme, mode });
  }
  return entries.length > 0 ? entries : undefined;
}

export function splitLessonSource(source: string): { frontmatterRaw: string | null; body: string } {
  const match = source.match(FRONTMATTER_RE);
  if (!match) return { frontmatterRaw: null, body: source.trim() };
  return { frontmatterRaw: match[1], body: source.slice(match[0].length).trim() };
}

export function parseLessonFile(source: string): ParsedLessonFile {
  const { frontmatterRaw, body } = splitLessonSource(source);
  const fallback: LessonFrontmatter = {
    sapixText: "",
    unit: "",
    cast: {},
  };
  if (!frontmatterRaw) {
    return { frontmatter: fallback, body };
  }
  try {
    const raw = yaml.load(frontmatterRaw);
    if (!raw || typeof raw !== "object") {
      return { frontmatter: fallback, body };
    }
    const record = raw as Record<string, unknown>;
    return {
      frontmatter: {
        sapixText: readString(record.sapixText),
        unit: readString(record.unit),
        focus: readString(record.focus) || undefined,
        cast: parseCast(record.cast),
        weekOutline: parseWeekOutline(record.weekOutline),
      },
      body,
    };
  } catch {
    return { frontmatter: fallback, body };
  }
}

export function textLabelFromFrontmatter(fm: LessonFrontmatter): string {
  if (!fm.sapixText && !fm.unit) return "";
  if (fm.sapixText && fm.unit) return `${fm.sapixText}「${fm.unit}」`;
  return fm.sapixText || fm.unit;
}

export function todayLabelFromFrontmatter(fm: LessonFrontmatter): string {
  return fm.focus ?? "";
}
