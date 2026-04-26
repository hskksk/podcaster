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

export function printLong(records: Array<Record<string, string>>): void {
  if (records.length === 0) { console.log("(no results)"); return; }
  const keyWidth = Math.max(...records.flatMap((r) => Object.keys(r).map((k) => k.length)));
  const sep = "─".repeat(keyWidth + 2 + 40);
  for (const [i, rec] of records.entries()) {
    if (i > 0) console.log(sep);
    for (const [k, v] of Object.entries(rec)) {
      console.log(`${(k + ":").padEnd(keyWidth + 1)}  ${v}`);
    }
  }
}
