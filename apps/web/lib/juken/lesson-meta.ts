import yaml from "js-yaml";
import type { CharacterId } from "./characters";
import { CHARACTER_IDS, characterById } from "./characters";

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
  textCode: string;
  unit: string;
  focus?: string;
  mode?: LessonMode;
  cast: LessonCast;
  weekCast?: CharacterId[];
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

function parseWeekCast(raw: unknown): CharacterId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids: CharacterId[] = [];
  for (const item of raw) {
    const id = readString(item);
    if (!characterById(id)) continue;
    ids.push(id as CharacterId);
  }
  return ids.length > 0 ? ids : undefined;
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
    textCode: "",
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
    const textCode =
      readString(record.textCode) ||
      readString(record.sapixText);
    return {
      frontmatter: {
        textCode,
        unit: readString(record.unit),
        focus: readString(record.focus) || undefined,
        mode:
          readString(record.mode) === "roleplay"
            ? "roleplay"
            : readString(record.mode) === "observation"
              ? "observation"
              : undefined,
        cast: parseCast(record.cast),
        weekCast: parseWeekCast(record.weekCast),
        weekOutline: parseWeekOutline(record.weekOutline),
      },
      body,
    };
  } catch {
    return { frontmatter: fallback, body };
  }
}

export function textLabelFromFrontmatter(fm: LessonFrontmatter): string {
  if (!fm.textCode && !fm.unit) return "";
  if (fm.textCode && fm.unit) return `${fm.textCode}「${fm.unit}」`;
  return fm.textCode || fm.unit;
}

export function todayLabelFromFrontmatter(fm: LessonFrontmatter): string {
  return fm.focus ?? "";
}

export function lessonModeLabel(mode: LessonMode): string {
  return mode === "roleplay" ? "人物体験" : "訪問・観察";
}

/** Resolve observation vs roleplay from day frontmatter, Monday weekOutline, or cast. */
export function resolveLessonMode(
  dayId: string,
  fm: LessonFrontmatter,
  weekOutline?: WeekOutlineEntry[],
): LessonMode {
  if (fm.mode) return fm.mode;
  const fromOutline = weekOutline?.find((entry) => entry.day === dayId);
  if (fromOutline) return fromOutline.mode;
  return Object.keys(fm.cast).length > 0 ? "roleplay" : "observation";
}

const SAY_CHARACTER_RE = /{%\s*say\s+[^%]*character="([^"]+)"/g;

export function sayCharacterIdsInBody(body: string): CharacterId[] {
  const found = new Set<CharacterId>();
  for (const match of body.matchAll(SAY_CHARACTER_RE)) {
    const id = match[1];
    if (id && characterById(id)) found.add(id as CharacterId);
  }
  return [...found];
}
