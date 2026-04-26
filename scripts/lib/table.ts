export function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log("(no results)");
    return;
  }
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const fmt = (cells: string[]) =>
    cells.map((c, i) => (c ?? "").padEnd(widths[i])).join("  ");
  console.log(fmt(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(fmt(row));
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function truncate(s: string, max = 50): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19);
}
