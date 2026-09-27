import { readFileSync } from "node:fs";
import { D2 } from "@terrastruct/d2";
import type { CompileResponse, Connection, Shape, Text } from "@terrastruct/d2";

export type D2Issue = { line: number; col: number; message: string };

export type D2Shape = {
  id: string;
  type: string;
  level: number;
  label: string;
  pos: { x: number; y: number };
  width: number;
  height: number;
};

export type D2Connection = { src: string; dst: string; label: string; strokeDash: number };

export type D2Layout = {
  shapes: D2Shape[];
  connections: D2Connection[];
  width: number;
  height: number;
  maxDepth: number;
};

export async function readD2Input(path: string | undefined): Promise<string> {
  if (path && path !== "-") {
    return readFileSync(path, "utf8");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const POSITIONED = /index:(\d+):(\d+):\s*([\s\S]+)$/;
const RANGE = /index,(\d+):(\d+):\d+-\d+:\d+:\d+/;

export function parseIssues(err: unknown): D2Issue[] {
  const raw = (err instanceof Error ? err.message : String(err)).trim();
  let entries: Array<{ errmsg?: string; range?: string }> | null = null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) entries = parsed as Array<{ errmsg?: string; range?: string }>;
  } catch {
    entries = null;
  }
  if (!entries || entries.length === 0) return [{ line: 0, col: 0, message: raw }];
  return entries.map((entry) => {
    const msg = typeof entry.errmsg === "string" ? entry.errmsg : raw;
    const m = POSITIONED.exec(msg);
    if (m) return { line: Number(m[1]), col: Number(m[2]), message: m[3].trim() };
    const r = typeof entry.range === "string" ? RANGE.exec(entry.range) : null;
    if (r) return { line: Number(r[1]), col: Number(r[2]), message: msg.trim() };
    return { line: 0, col: 0, message: msg.trim() };
  });
}

export function formatIssue(issue: D2Issue, src: string, label: string): string {
  if (issue.line <= 0) return `${label}: ${issue.message}`;
  const text = (src.split("\n")[issue.line - 1] ?? "").trim();
  const caret = " ".repeat(Math.max(issue.col - 1, 0)) + "^";
  return [`${label}:${issue.line}:${issue.col}: ${issue.message}`, `  ${text}`, `  ${caret}`].join("\n");
}

export function printIssues(err: unknown, src: string, label: string): void {
  for (const issue of parseIssues(err)) {
    console.error(formatIssue(issue, src, label));
  }
}

function labelOf(shape: Shape | Connection): string {
  const text = shape as Partial<Text>;
  return typeof text.label === "string" ? text.label : "";
}

export function readLayout(response: CompileResponse): D2Layout {
  const shapes: D2Shape[] = (response.diagram.shapes ?? []).map((shape) => ({
    id: shape.id,
    type: shape.type,
    level: shape.level,
    label: labelOf(shape),
    pos: { x: shape.pos?.x ?? 0, y: shape.pos?.y ?? 0 },
    width: shape.width ?? 0,
    height: shape.height ?? 0,
  }));
  const connections: D2Connection[] = (response.diagram.connections ?? []).map((conn) => ({
    src: conn.src,
    dst: conn.dst,
    label: labelOf(conn),
    strokeDash: conn.strokeDash ?? 0,
  }));

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxDepth = 0;
  for (const shape of shapes) {
    minX = Math.min(minX, shape.pos.x);
    minY = Math.min(minY, shape.pos.y);
    maxX = Math.max(maxX, shape.pos.x + shape.width);
    maxY = Math.max(maxY, shape.pos.y + shape.height);
    maxDepth = Math.max(maxDepth, shape.level);
  }
  if (shapes.length === 0) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  return {
    shapes,
    connections,
    width: maxX - minX,
    height: maxY - minY,
    maxDepth,
  };
}

export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1f9ff);
    w += wide ? 2 : 1;
  }
  return w;
}

export function renderAscii(response: CompileResponse): Promise<string> {
  return new D2().render(response.diagram, { ...response.renderOptions, ascii: true });
}

export function renderSvg(response: CompileResponse): Promise<string> {
  return new D2().render(response.diagram, { ...response.renderOptions, noXMLTag: true });
}
