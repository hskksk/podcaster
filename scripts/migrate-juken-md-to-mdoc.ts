/**
 * One-shot: chugaku-juken lesson .md → .mdoc (Markdoc + YAML frontmatter).
 * Usage: pnpm exec tsx scripts/migrate-juken-md-to-mdoc.ts [weekDir]
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const NAME_TO_ID: Record<string, string> = {
  くまぴー: "kuma",
  とらぴー: "tora",
  ねこぴー: "neko",
  きつぴー: "kitsu",
};

const DAY_MAP: Record<string, string> = {
  月: "mon",
  火: "tue",
  水: "wed",
  木: "thu",
  金: "fri",
};

const DIALOGUE =
  /^(?:(\p{Extended_Pictographic}\uFE0F?)\s*)?([^\s：（「]{1,24})(?:（([^）]+)）)?[：:]「([^」]*)」\s*(?:（([^）]*)）)?\s*$/u;

function escapeAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseWeekOutline(lines: string[]) {
  const entries = [];
  for (const line of lines) {
    const m = line.match(/^[-*]\s*([月火水木金])：(.+)$/);
    if (!m) continue;
    const day = DAY_MAP[m[1]!];
    const rest = m[2]!.trim();
    const roleplay = rest.match(/^(.+?)（人物体験(?:：(.+))?）$/);
    if (roleplay) {
      entries.push({
        day,
        theme: roleplay[1]!.trim(),
        mode: "roleplay",
        ...(roleplay[2] ? { roles: roleplay[2]!.trim() } : {}),
      });
    } else {
      const obs = rest.replace(/（観察）$/, "").trim();
      entries.push({ day, theme: obs, mode: "observation" });
    }
  }
  return entries;
}

function convertBody(lines: string[]): { body: string[]; cast: Record<string, string> } {
  const out: string[] = [];
  const cast: Record<string, string> = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^---+$/.test(line)) continue;
    if (/^#\s+/.test(line)) continue;
    if (line.startsWith("**")) continue;
    if (/^[-*]\s+[月火水木金]：/.test(line)) continue;

    const dialogue = line.match(DIALOGUE);
    if (dialogue) {
      const speaker = dialogue[2] ?? "";
      const role = dialogue[3] ?? "";
      const text = dialogue[4] ?? "";
      const note = dialogue[5] ?? "";
      const id = NAME_TO_ID[speaker];
      if (!id) {
        console.warn(`skip unknown speaker: ${speaker}`);
        continue;
      }
      if (role) cast[id] = role;
      const noteAttr = note ? ` note="${escapeAttr(note)}"` : "";
      out.push(`{% say character="${id}"${noteAttr} %}`);
      out.push(text);
      out.push("{% /say %}");
      out.push("");
      continue;
    }
    if (line.startsWith("*") && line.endsWith("*") && line.length > 2) {
      out.push("{% scene %}");
      out.push(line.slice(1, -1).trim());
      out.push("{% /scene %}");
      out.push("");
      continue;
    }
    out.push(line);
  }
  return { body: out, cast };
}

function migrateFile(mdPath: string) {
  const source = fs.readFileSync(mdPath, "utf8");
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  let textCode = "";
  let unit = "";
  let focus = "";
  let weekOutline: unknown;

  for (const line of lines) {
    const weekText = line.match(/\*\*今週のテキスト\*\*\s*(\S+)/);
    if (weekText) {
      const chunk = line.replace(/\*\*今週のテキスト\*\*\s*/, "");
      const m = chunk.match(/^(\S+?)「(.+?)」/);
      if (m) {
        textCode = m[1]!;
        unit = m[2]!;
      }
    }
    const dayText = line.match(/\*\*テキスト\*\*\s*(\S+?)「(.+?)」/);
    if (dayText) {
      textCode = dayText[1]!;
      unit = dayText[2]!;
    }
    const today = line.match(/\*\*今日\*\*\s*(.+)$/);
    if (today) focus = today[1]!.trim();
    if (line.includes("今週のテーマ一覧")) {
      const start = lines.indexOf(line);
      const listLines = lines.slice(start + 1).filter((l) => /^[-*]\s+[月火水木金]：/.test(l.trim()));
      weekOutline = parseWeekOutline(listLines);
    }
  }

  const { body, cast } = convertBody(lines);
  const frontmatter: Record<string, unknown> = {
    textCode,
    unit,
  };
  if (focus) frontmatter.focus = focus;
  if (weekOutline) frontmatter.weekOutline = weekOutline;
  if (Object.keys(cast).length > 0) frontmatter.cast = cast;

  const mdoc = `---\n${yaml.dump(frontmatter, { lineWidth: 120 }).trim()}\n---\n\n${body.join("\n").trim()}\n`;
  const mdocPath = mdPath.replace(/\.md$/, ".mdoc");
  fs.writeFileSync(mdocPath, mdoc, "utf8");
  fs.unlinkSync(mdPath);
  console.log(`wrote ${path.relative(REPO_ROOT, mdocPath)}`);
}

const weekArg = process.argv[2];
const defaultWeek = path.join(
  REPO_ROOT,
  "chugaku-juken/sapix/grade5-japanese-history/weeks/2026-10-19",
);
const weekDir = weekArg ? path.resolve(weekArg) : defaultWeek;

for (const name of fs.readdirSync(weekDir)) {
  if (name.endsWith(".md")) {
    migrateFile(path.join(weekDir, name));
  }
}
