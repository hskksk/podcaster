export type ScriptLine = { speaker: string; text: string };

export function parseScript(content: string, hostName: string, cohostName: string): ScriptLine[] {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) return parsed.map(toScriptLine);
    return [];
  } catch {
    const normalized = normalize(content).replace(/\\n/g, "\n");
    return insertNewlinesBeforeSpeakerLabels(normalized, hostName, cohostName)
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
        if (match) return toScriptLine({ speaker: match[1], text: match[2].trim() });
        return toScriptLine({ speaker: "?", text: line });
      });
  }
}

export function summarizeScript(lines: ScriptLine[]): string {
  if (lines.length === 0) return "No script generated yet.";
  const speakers = Array.from(new Set(lines.map((line) => line.speaker).filter(Boolean)));
  const charCount = lines.reduce((sum, line) => sum + line.text.length, 0);
  return `${lines.length} lines · ${charCount} chars · ${speakers.length} speakers (${speakers.join(", ")})`;
}

function toScriptLine(raw: unknown): ScriptLine {
  const row = raw as { speaker?: unknown; text?: unknown } | null;
  const speaker = normalize(String(row?.speaker ?? "?")).trim() || "?";
  const text = normalize(String(row?.text ?? ""));
  return { speaker, text };
}

function insertNewlinesBeforeSpeakerLabels(content: string, hostName: string, cohostName: string): string {
  const unique = [hostName, cohostName].filter((name, index, all) => all.indexOf(name) === index);
  const sorted = [...unique].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sorted.map(escapeRegex).join("|")}):`, "g");
  return content.replace(pattern, (match, _group, offset: number, source: string) => {
    if (offset === 0) return match;
    if (source[offset - 1] === "\n") return match;
    return `\n${match}`;
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
