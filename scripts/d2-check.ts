import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { D2 } from "@terrastruct/d2";
import {
  displayWidth,
  printIssues,
  readD2Input,
  readLayout,
  renderAscii,
  renderSvg,
  type D2Layout,
} from "./lib/d2.ts";

const ARTICLE_COLUMN_PX = 768;

type Budget = {
  maxShapes: number;
  maxEdges: number;
  maxDepth: number;
  maxWidth: number;
  maxFanout: number;
  maxLabel: number;
};

const DEFAULT_BUDGET: Budget = {
  maxShapes: 40,
  maxEdges: 60,
  maxDepth: 3,
  maxWidth: ARTICLE_COLUMN_PX,
  maxFanout: 4,
  maxLabel: 24,
};

type Options = {
  path?: string;
  svg?: string;
  ascii: boolean;
  budget: Budget;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { ascii: true, budget: { ...DEFAULT_BUDGET } };
  const set = (key: keyof Budget, value: string | undefined): void => {
    const n = Number(value);
    if (!value || !Number.isFinite(n) || n <= 0) {
      console.error(`d2-check: invalid value for --${key}: ${value ?? ""}`);
      process.exit(1);
    }
    options.budget[key] = Math.floor(n);
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--no-ascii") options.ascii = false;
    else if (arg === "--svg") options.svg = argv[++i];
    else if (arg === "--max-shapes") set("maxShapes", argv[++i]);
    else if (arg === "--max-edges") set("maxEdges", argv[++i]);
    else if (arg === "--max-depth") set("maxDepth", argv[++i]);
    else if (arg === "--max-width") set("maxWidth", argv[++i]);
    else if (arg === "--max-fanout") set("maxFanout", argv[++i]);
    else if (arg === "--max-label") set("maxLabel", argv[++i]);
    else if (arg === "-h" || arg === "--help") {
      console.log(
        [
          "usage: d2-check <input.d2|-> [options]",
          "  --no-ascii        skip the ASCII structure preview",
          "  --svg <path>      also write the SVG (open in a browser to check typography)",
          "  --max-shapes N    default 40 (D2 shapes, sql_table columns included)",
          "  --max-edges N     default 60",
          "  --max-depth N     default 3",
          "  --max-width N     default 768 (article column width, diagrams are width-fit)",
          "  --max-fanout N    default 4 (edges leaving one node)",
          "  --max-label N     default 24 (display width, CJK counts 2)",
        ].join("\n")
      );
      process.exit(0);
    } else if (arg.startsWith("-") && arg !== "-") {
      console.error(`d2-check: unknown option ${arg}`);
      process.exit(1);
    } else if (options.path === undefined) {
      options.path = arg;
    } else {
      console.error("d2-check: too many positional arguments");
      process.exit(1);
    }
  }
  return options;
}

function audit(layout: D2Layout, budget: Budget): string[] {
  const warnings: string[] = [];
  const { shapes, connections } = layout;
  const connected = new Set<string>();
  for (const conn of connections) {
    connected.add(conn.src);
    connected.add(conn.dst);
  }

  const shapesNoTitle = shapes.filter((s) => s.type !== "text" && s.label !== "title");
  if (shapesNoTitle.length > budget.maxShapes) {
    warnings.push(
      `shapes ${shapesNoTitle.length} > ${budget.maxShapes}: 図を分割するか、コンテナで束ねる`
    );
  }
  if (connections.length > budget.maxEdges) {
    warnings.push(`edges ${connections.length} > ${budget.maxEdges}: 1 枚に収めるには多すぎる`);
  }
  if (layout.maxDepth > budget.maxDepth) {
    const deepest = shapes
      .filter((s) => s.level === layout.maxDepth)
      .slice(0, 3)
      .map((s) => s.id);
    warnings.push(
      `nest depth ${layout.maxDepth} > ${budget.maxDepth}: ${deepest.join(", ")} — 入れ子を平坦化する`
    );
  }
  if (layout.width > budget.maxWidth) {
    const scale = Math.round((budget.maxWidth / layout.width) * 100);
    warnings.push(
      `width ${layout.width}px > ${budget.maxWidth}px: 本文では ${scale}% に縮尺されラベルが読めなくなる`
    );
  }

  const fanout = new Map<string, number>();
  for (const conn of connections) {
    fanout.set(conn.src, (fanout.get(conn.src) ?? 0) + 1);
  }
  for (const [src, count] of [...fanout.entries()].sort((a, b) => b[1] - a[1])) {
    if (count > budget.maxFanout) {
      warnings.push(`fan-out ${count} > ${budget.maxFanout} from ${src}: 集約ノードを挟む`);
    }
  }

  const labels = [
    ...shapesNoTitle.map((s) => ({ where: s.id, text: s.label })),
    ...connections
      .filter((c) => c.label.length > 0)
      .map((c) => ({ where: `${c.src} -> ${c.dst}`, text: c.label })),
  ]
    .map((l) => ({ ...l, w: displayWidth(l.text) }))
    .filter((l) => l.w > budget.maxLabel)
    .sort((a, b) => b.w - a.w);
  for (const label of labels.slice(0, 5)) {
    warnings.push(
      `label width ${label.w} > ${budget.maxLabel}: ${label.where} "${label.text}" — 短い語に置き換える`
    );
  }
  if (labels.length > 5) {
    warnings.push(`label width > ${budget.maxLabel}: 他 ${labels.length - 5} 件`);
  }

  const parents = new Set<string>();
  for (const shape of shapesNoTitle) {
    const dot = shape.id.lastIndexOf(".");
    if (dot > 0) parents.add(shape.id.slice(0, dot));
  }
  for (const shape of shapesNoTitle) {
    if (parents.has(shape.id)) continue;
    if (!connected.has(shape.id)) {
      warnings.push(
        `isolated shape ${shape.id} (level ${shape.level}): 意図がなければ接続不足 — コンテナ内ノードの参照は完全修飾名で書く`
      );
    }
  }

  return warnings;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const label = options.path && options.path !== "-" ? options.path : "<stdin>";
  const src = (await readD2Input(options.path)).trim();
  if (!src) {
    console.error("d2-check: empty input (pass a .d2 file path or stdin)");
    process.exit(1);
  }

  let response;
  try {
    response = await new D2().compile(src);
  } catch (err) {
    printIssues(err, src, label);
    process.exit(1);
  }

  const layout = readLayout(response);
  const warnings = audit(layout, options.budget);
  const scale = Math.round((Math.min(1, ARTICLE_COLUMN_PX / Math.max(layout.width, 1))) * 100);

  console.log(`source: ${label}`);
  console.log(
    `layout: ${layout.width}x${layout.height}px (article column ${ARTICLE_COLUMN_PX}px -> ${scale}%), ` +
      `shapes ${layout.shapes.length}, edges ${layout.connections.length}, depth ${layout.maxDepth}`
  );

  if (options.ascii) {
    console.log("");
    console.log("ascii (structure and connectivity; `title: |md` blocks show as an empty box):");
    console.log((await renderAscii(response)).replace(/\s+$/, ""));
  }

  if (options.svg) {
    const out = resolve(options.svg);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, await renderSvg(response), "utf8");
    console.log("");
    console.log(`svg: ${out}`);
  }

  console.log("");
  if (warnings.length > 0) {
    console.log(`warnings (${warnings.length}):`);
    for (const warning of warnings) console.log(`  - ${warning}`);
    console.log("");
    console.error("d2-check: fix warnings above and re-run (expect `warnings: none`)");
    process.exit(1);
  }
  console.log("warnings: none");
  console.log("");
  console.log("ok");
  process.exit(0);
}

await main();
