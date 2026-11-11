/**
 * Article Visual spec v1 — authoring validator (podcaster).
 * Canonical types will move to `@hskksk/markdoc-react` when the engine ships.
 */

export const ARTICLE_VISUAL_ENGINE = "article-visual" as const;
export const ARTICLE_VISUAL_ENGINE_VERSION = "1" as const;

export const SPEC_TYPES = [
  "cards",
  "sequence",
  "interaction",
  "comparison",
  "hierarchy",
  "flow",
  "matrix",
  "chart",
] as const;

export type ArticleVisualSpecType = (typeof SPEC_TYPES)[number];

export const ICON_IDS = new Set([
  "person",
  "document",
  "database",
  "shield",
  "timer",
  "workspace",
  "service",
  "network",
  "chart",
]);

const FORBIDDEN_SPEC_KEYS = new Set([
  "color",
  "className",
  "class",
  "style",
  "href",
  "url",
  "src",
  "path",
  "x",
  "y",
  "width",
  "height",
  "fontSize",
  "coordinates",
]);

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function assertNoUnknownKeys(obj: UnknownRecord, allowed: Set<string>, path: string, errors: string[]) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      if (FORBIDDEN_SPEC_KEYS.has(key) || key.endsWith("Url") || key.includes("svg")) {
        errors.push(`${path}: forbidden field "${key}"`);
      } else {
        errors.push(`${path}: unknown field "${key}"`);
      }
    }
  }
}

function assertString(v: unknown, path: string, errors: string[], max = 240): string | null {
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${path}: required non-empty string`);
    return null;
  }
  const s = v.trim();
  if (s.length > max) {
    errors.push(`${path}: exceeds ${max} characters (${s.length})`);
  }
  return s;
}

function assertOptionalString(v: unknown, path: string, errors: string[], max = 240): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = assertString(v, path, errors, max);
  return s ?? undefined;
}

function assertBoolean(v: unknown, path: string, errors: string[]): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "boolean") {
    errors.push(`${path}: must be boolean`);
    return undefined;
  }
  return v;
}

function assertIcon(v: unknown, path: string, errors: string[]): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !ICON_IDS.has(v)) {
    errors.push(`${path}: unknown icon "${String(v)}"`);
    return undefined;
  }
  return v;
}

function countEmphasis(items: { emphasis?: boolean }[], path: string, errors: string[]) {
  const n = items.filter((i) => i.emphasis).length;
  if (n > 2) errors.push(`${path}: at most 2 emphasis items; got ${n}`);
}

function parseLabeledItem(
  raw: unknown,
  path: string,
  errors: string[],
  opts: { id?: boolean; allowIcon?: boolean },
): { id?: string; label: string; detail?: string; icon?: string; emphasis?: boolean } | null {
  if (!isRecord(raw)) {
    errors.push(`${path}: must be object`);
    return null;
  }
  const keys = new Set(["label", "detail", "emphasis"]);
  if (opts.id) keys.add("id");
  if (opts.allowIcon) keys.add("icon");
  assertNoUnknownKeys(raw, keys, path, errors);
  const label = assertString(raw.label, `${path}.label`, errors, 120);
  if (!label) return null;
  const item = {
    ...(opts.id ? { id: assertString(raw.id, `${path}.id`, errors, 64) ?? undefined } : {}),
    label,
    detail: assertOptionalString(raw.detail, `${path}.detail`, errors, 200),
    ...(opts.allowIcon ? { icon: assertIcon(raw.icon, `${path}.icon`, errors) } : {}),
    emphasis: assertBoolean(raw.emphasis, `${path}.emphasis`, errors),
  };
  return item;
}

function parseFlowGraph(
  nodes: { id: string }[],
  edges: { from: string; to: string }[],
  path: string,
  errors: string[],
) {
  const ids = new Set(nodes.map((n) => n.id));
  for (const [i, e] of edges.entries()) {
    if (!ids.has(e.from)) errors.push(`${path}.edges[${i}].from: unknown node "${e.from}"`);
    if (!ids.has(e.to)) errors.push(`${path}.edges[${i}].to: unknown node "${e.to}"`);
  }
  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);
  const indeg = new Map<string, number>();
  for (const id of ids) indeg.set(id, 0);
  for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const q = [...ids].filter((id) => (indeg.get(id) ?? 0) === 0);
  let visited = 0;
  while (q.length) {
    const u = q.shift()!;
    visited += 1;
    for (const v of adj.get(u) ?? []) {
      const d = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, d);
      if (d === 0) q.push(v);
    }
  }
  if (visited !== ids.size) {
    errors.push(`${path}: flow must be a DAG (cycle detected)`);
  }
}

function parseHierarchyNode(raw: unknown, path: string, errors: string[], depth: number): void {
  if (depth > 4) {
    errors.push(`${path}: hierarchy depth exceeds 4`);
    return;
  }
  if (!isRecord(raw)) {
    errors.push(`${path}: must be object`);
    return;
  }
  assertNoUnknownKeys(raw, new Set(["label", "detail", "emphasis", "icon", "children"]), path, errors);
  assertString(raw.label, `${path}.label`, errors, 120);
  assertOptionalString(raw.detail, `${path}.detail`, errors, 200);
  assertBoolean(raw.emphasis, `${path}.emphasis`, errors);
  assertIcon(raw.icon, `${path}.icon`, errors);
  const children = raw.children;
  if (children === undefined) return;
  if (!Array.isArray(children)) {
    errors.push(`${path}.children: must be array`);
    return;
  }
  for (const [i, child] of children.entries()) {
    parseHierarchyNode(child, `${path}.children[${i}]`, errors, depth + 1);
  }
}

function countHierarchyNodes(raw: unknown): number {
  if (!isRecord(raw)) return 0;
  let n = 1;
  const children = raw.children;
  if (Array.isArray(children)) {
    for (const c of children) n += countHierarchyNodes(c);
  }
  return n;
}

export function validateArticleVisualSpecV1(spec: unknown, errors: string[]): spec is UnknownRecord {
  if (!isRecord(spec)) {
    errors.push("spec: must be object");
    return false;
  }
  assertNoUnknownKeys(
    spec,
    new Set([
      "type",
      "title",
      "caption",
      "items",
      "mode",
      "actors",
      "steps",
      "sides",
      "root",
      "nodes",
      "edges",
      "xAxis",
      "yAxis",
      "variant",
      "unit",
      "values",
    ]),
    "spec",
    errors,
  );

  const type = assertString(spec.type, "spec.type", errors, 32) as ArticleVisualSpecType | null;
  if (!type || !SPEC_TYPES.includes(type)) {
    errors.push(`spec.type: must be one of ${SPEC_TYPES.join(", ")}`);
    return false;
  }
  assertString(spec.title, "spec.title", errors, 160);
  assertOptionalString(spec.caption, "spec.caption", errors, 240);

  switch (type) {
    case "cards": {
      const items = spec.items;
      if (!Array.isArray(items) || items.length < 2 || items.length > 6) {
        errors.push("spec.items: cards requires 2–6 items");
        break;
      }
      const parsed = items.map((it, i) => parseLabeledItem(it, `spec.items[${i}]`, errors, { allowIcon: true }));
      countEmphasis(parsed.filter(Boolean) as { emphasis?: boolean }[], "spec.items", errors);
      break;
    }
    case "sequence": {
      const mode = assertString(spec.mode, "spec.mode", errors, 32);
      if (mode && !["steps", "timeline", "funnel"].includes(mode)) {
        errors.push("spec.mode: must be steps, timeline, or funnel");
      }
      const items = spec.items;
      if (!Array.isArray(items) || items.length < 3 || items.length > 7) {
        errors.push("spec.items: sequence requires 3–7 items");
        break;
      }
      const parsed = items.map((it, i) => parseLabeledItem(it, `spec.items[${i}]`, errors, { allowIcon: true }));
      countEmphasis(parsed.filter(Boolean) as { emphasis?: boolean }[], "spec.items", errors);
      break;
    }
    case "interaction": {
      const actors = spec.actors;
      if (!Array.isArray(actors) || actors.length < 2 || actors.length > 4) {
        errors.push("spec.actors: interaction requires 2–4 actors");
        break;
      }
      const actorRows = actors.map((a, i) => parseLabeledItem(a, `spec.actors[${i}]`, errors, { id: true }));
      const actorIds = new Set(actorRows.map((a) => a?.id).filter(Boolean) as string[]);
      const steps = spec.steps;
      if (!Array.isArray(steps) || steps.length < 2 || steps.length > 8) {
        errors.push("spec.steps: interaction requires 2–8 steps");
        break;
      }
      for (const [i, step] of steps.entries()) {
        if (!isRecord(step)) {
          errors.push(`spec.steps[${i}]: must be object`);
          continue;
        }
        assertNoUnknownKeys(step, new Set(["from", "to", "label"]), `spec.steps[${i}]`, errors);
        const from = assertString(step.from, `spec.steps[${i}].from`, errors, 64);
        const to = assertString(step.to, `spec.steps[${i}].to`, errors, 64);
        assertString(step.label, `spec.steps[${i}].label`, errors, 120);
        if (from && !actorIds.has(from)) errors.push(`spec.steps[${i}].from: unknown actor`);
        if (to && !actorIds.has(to)) errors.push(`spec.steps[${i}].to: unknown actor`);
      }
      break;
    }
    case "comparison": {
      const sides = spec.sides;
      if (!Array.isArray(sides) || sides.length !== 2) {
        errors.push("spec.sides: comparison requires exactly 2 sides");
        break;
      }
      for (const [si, side] of sides.entries()) {
        if (!isRecord(side)) {
          errors.push(`spec.sides[${si}]: must be object`);
          continue;
        }
        assertNoUnknownKeys(side, new Set(["label", "emphasis", "items"]), `spec.sides[${si}]`, errors);
        assertString(side.label, `spec.sides[${si}].label`, errors, 120);
        assertBoolean(side.emphasis, `spec.sides[${si}].emphasis`, errors);
        const items = side.items;
        if (!Array.isArray(items) || items.length < 2 || items.length > 5) {
          errors.push(`spec.sides[${si}].items: requires 2–5 items`);
          continue;
        }
        items.forEach((it, i) => parseLabeledItem(it, `spec.sides[${si}].items[${i}]`, errors, {}));
      }
      break;
    }
    case "hierarchy": {
      if (spec.root === undefined) {
        errors.push("spec.root: required");
        break;
      }
      parseHierarchyNode(spec.root, "spec.root", errors, 1);
      const total = countHierarchyNodes(spec.root);
      if (total > 12) errors.push(`spec.root: hierarchy allows at most 12 nodes; got ${total}`);
      break;
    }
    case "flow": {
      const nodes = spec.nodes;
      if (!Array.isArray(nodes) || nodes.length < 3 || nodes.length > 9) {
        errors.push("spec.nodes: flow requires 3–9 nodes");
        break;
      }
      const parsed = nodes.map((n, i) => parseLabeledItem(n, `spec.nodes[${i}]`, errors, { id: true, allowIcon: true }));
      countEmphasis(parsed.filter(Boolean) as { emphasis?: boolean }[], "spec.nodes", errors);
      const edges = spec.edges;
      if (!Array.isArray(edges) || edges.length < 2 || edges.length > 12) {
        errors.push("spec.edges: flow requires 2–12 edges");
        break;
      }
      const edgeRows: { from: string; to: string }[] = [];
      for (const [i, e] of edges.entries()) {
        if (!isRecord(e)) {
          errors.push(`spec.edges[${i}]: must be object`);
          continue;
        }
        assertNoUnknownKeys(e, new Set(["from", "to", "label"]), `spec.edges[${i}]`, errors);
        const from = assertString(e.from, `spec.edges[${i}].from`, errors, 64);
        const to = assertString(e.to, `spec.edges[${i}].to`, errors, 64);
        assertOptionalString(e.label, `spec.edges[${i}].label`, errors, 80);
        if (from && to) edgeRows.push({ from, to });
      }
      parseFlowGraph(
        parsed.filter(Boolean).map((n) => ({ id: n!.id! })),
        edgeRows,
        "spec",
        errors,
      );
      break;
    }
    case "matrix": {
      for (const axis of ["xAxis", "yAxis"] as const) {
        const ax = spec[axis];
        if (!isRecord(ax)) {
          errors.push(`spec.${axis}: must be object`);
          continue;
        }
        assertNoUnknownKeys(ax, new Set(["low", "high"]), `spec.${axis}`, errors);
        assertString(ax.low, `spec.${axis}.low`, errors, 80);
        assertString(ax.high, `spec.${axis}.high`, errors, 80);
      }
      const items = spec.items;
      if (!Array.isArray(items) || items.length < 1 || items.length > 8) {
        errors.push("spec.items: matrix requires 1–8 items");
        break;
      }
      const quads = new Set(["low-low", "low-high", "high-low", "high-high"]);
      for (const [i, it] of items.entries()) {
        if (!isRecord(it)) {
          errors.push(`spec.items[${i}]: must be object`);
          continue;
        }
        assertNoUnknownKeys(it, new Set(["label", "quadrant", "emphasis", "detail"]), `spec.items[${i}]`, errors);
        assertString(it.label, `spec.items[${i}].label`, errors, 120);
        const q = assertString(it.quadrant, `spec.items[${i}].quadrant`, errors, 16);
        if (q && !quads.has(q)) errors.push(`spec.items[${i}].quadrant: invalid quadrant`);
        assertBoolean(it.emphasis, `spec.items[${i}].emphasis`, errors);
        assertOptionalString(it.detail, `spec.items[${i}].detail`, errors, 200);
      }
      countEmphasis(items as { emphasis?: boolean }[], "spec.items", errors);
      break;
    }
    case "chart": {
      const variant = assertString(spec.variant, "spec.variant", errors, 16);
      if (variant && !["bar", "line", "donut"].includes(variant)) {
        errors.push("spec.variant: must be bar, line, or donut");
      }
      assertOptionalString(spec.unit, "spec.unit", errors, 24);
      const values = spec.values;
      if (!Array.isArray(values) || values.length < 2 || values.length > 8) {
        errors.push("spec.values: chart requires 2–8 values");
        break;
      }
      for (const [i, row] of values.entries()) {
        if (!isRecord(row)) {
          errors.push(`spec.values[${i}]: must be object`);
          continue;
        }
        assertNoUnknownKeys(row, new Set(["label", "value", "emphasis"]), `spec.values[${i}]`, errors);
        assertString(row.label, `spec.values[${i}].label`, errors, 120);
        const val = row.value;
        if (typeof val !== "number" || !Number.isFinite(val)) {
          errors.push(`spec.values[${i}].value: must be finite number`);
        }
        assertBoolean(row.emphasis, `spec.values[${i}].emphasis`, errors);
      }
      countEmphasis(values as { emphasis?: boolean }[], "spec.values", errors);
      break;
    }
    default:
      break;
  }

  return errors.length === 0;
}
