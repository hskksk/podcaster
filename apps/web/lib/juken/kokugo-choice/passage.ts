/** 本文の傍線部（`**…**`）の解析と、根拠の抜き出しを本文上の範囲に直す処理。 */

export type ParsedPassage = {
  /** `**` を取り除いた本文 */
  text: string;
  /** 傍線部の [start, end)。なければ null */
  underline: [number, number] | null;
};

export function parsePassage(passage: string): ParsedPassage {
  let text = "";
  let underline: [number, number] | null = null;
  let open: number | null = null;
  const parts = passage.split("**");
  parts.forEach((part, index) => {
    if (index > 0) {
      if (open === null) {
        open = text.length;
      } else {
        underline ??= [open, text.length];
        open = null;
      }
    }
    text += part;
  });
  return { text, underline };
}

/** `…` / `...` でつないだ抜き出しを片ごとに分ける。 */
export function splitEvidence(evidence: string): string[] {
  return evidence
    .split(/…+|\.{3,}|⋯/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 本文（空白を無視）の中で evidence の最初の出現位置を [start, end) で返す。見つからなければ null。
 * `text` は `parsePassage` で `**` を除いたもの。
 */
export function findEvidenceRange(text: string, evidence: string): [number, number] | null {
  const needle = evidence.replace(/\*\*/g, "").replace(/\s+/g, "");
  if (!needle) return null;

  let squeezed = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (/\s/.test(ch)) continue;
    squeezed += ch;
    origin.push(i);
  }

  const at = squeezed.indexOf(needle);
  if (at < 0) return null;
  return [origin[at]!, origin[at + needle.length - 1]! + 1];
}

export type PassageSegment = {
  text: string;
  underline: boolean;
  mark: boolean;
};

/** 傍線部と強調する根拠の範囲で本文を区切り、同じ装飾が続く部分ごとにまとめる。 */
export function buildSegments(passage: string, highlights: readonly string[]): PassageSegment[] {
  const { text, underline } = parsePassage(passage);
  const under = new Array<boolean>(text.length).fill(false);
  const mark = new Array<boolean>(text.length).fill(false);
  if (underline) for (let i = underline[0]; i < underline[1]; i += 1) under[i] = true;
  for (const quote of highlights.flatMap(splitEvidence)) {
    const range = findEvidenceRange(text, quote);
    if (range) for (let i = range[0]; i < range[1]; i += 1) mark[i] = true;
  }

  const segments: PassageSegment[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const last = segments[segments.length - 1];
    if (last && last.underline === under[i] && last.mark === mark[i]) {
      last.text += text[i];
    } else {
      segments.push({ text: text[i]!, underline: under[i]!, mark: mark[i]! });
    }
  }
  return segments;
}
