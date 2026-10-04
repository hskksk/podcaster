/**
 * Server-safe Markdoc config aligned with @hskksk/markdoc-react built-ins.
 * The npm package is client-only (`createMarkdocConfig` cannot run in RSC).
 *
 * Sync check: when bumping `@hskksk/markdoc-react`, diff against package
 * `createMarkdocConfig` / built-in nodes+tags (or switch to a `/server` entry).
 */
import {
  nodes as markdocNodes,
  Tag,
  type Config,
  type Node,
  type Schema,
} from "@markdoc/markdoc";
import type { MarkdocExtensions } from "./extensions";
import { markdocSlugify } from "./slugify";

const LITERAL_FENCE_LANGUAGES = new Set(["md", "markdown", "markdoc", "mdoc"]);

const headingIds = new WeakMap<Config, Set<string>>();

function resetHeadingIds(config: Config): void {
  headingIds.set(config, new Set());
}

function uniqueHeadingId(base: string, config: Config): string {
  let used = headingIds.get(config);
  if (!used) {
    used = new Set();
    headingIds.set(config, used);
  }
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

function renderableText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((child) => renderableText(child)).join("");
  if (value && typeof value === "object" && "children" in value) {
    return renderableText((value as { children?: unknown }).children);
  }
  return "";
}

function fenceUsesLiteralContent(language: string | undefined, process: boolean | undefined): boolean {
  if (process === false) return true;
  if (process === true) return false;
  return language != null && LITERAL_FENCE_LANGUAGES.has(language);
}

function fenceHasTags(node: Node): boolean {
  return node.children.some((child) => child.type === "tag");
}

function createFenceSchema(mode: "document" | "off"): Schema {
  return {
    render: "CodeFence",
    attributes: markdocNodes.fence.attributes,
    transform(node: Node, config: Config) {
      const attributes = node.transformAttributes(config);
      const language =
        typeof node.attributes.language === "string" ? node.attributes.language : undefined;
      const processFlag = attributes.process as boolean | undefined;
      const content =
        typeof node.attributes.content === "string" ? node.attributes.content : undefined;
      const literal = mode === "off" || fenceUsesLiteralContent(language, processFlag);
      const processed = !literal && fenceHasTags(node);
      const children =
        processed ? node.transformChildren(config) : content == null ? [] : [content];
      return new Tag("CodeFence", { ...attributes, language, content, processed }, children);
    },
  };
}

const document: Schema = {
  ...markdocNodes.document,
  transform(node: Node, config: Config) {
    resetHeadingIds(config);
    return new Tag(
      markdocNodes.document.render ?? "article",
      node.transformAttributes(config),
      node.transformChildren(config),
    );
  },
};

const heading: Schema = {
  render: "Heading",
  attributes: {
    level: { type: Number, required: true },
    id: { type: String },
  },
  transform(node: Node, config: Config) {
    const attributes = node.transformAttributes(config);
    const children = node.transformChildren(config);
    const explicit =
      typeof node.attributes.id === "string" ? node.attributes.id.trim() : "";
    const base = explicit || markdocSlugify(renderableText(children));
    const id = base ? uniqueHeadingId(base, config) : undefined;
    const next: Record<string, unknown> = { ...attributes, level: node.attributes.level };
    if (id) next.id = id;
    else delete next.id;
    return new Tag("Heading", next, children);
  },
};

const table: Schema = {
  ...markdocNodes.table,
  transform(node: Node, config: Config) {
    const children = node.transformChildren(config);
    return new Tag("div", { class: "markdoc-table-wrap" }, [new Tag("table", {}, children)]);
  },
};

const builtinNodes = {
  ...markdocNodes,
  document,
  fence: createFenceSchema("document"),
  heading,
  table,
};

function plainText(node: Node): string {
  if (node.type === "text" || node.type === "code") {
    return typeof node.attributes.content === "string" ? node.attributes.content : "";
  }
  if (node.type === "softbreak" || node.type === "hardbreak") return "\n";
  return node.children.map(plainText).join("");
}

function diagramFence(node: Node): Node | undefined {
  return node.children.find((child) => {
    if (child.type !== "fence") return false;
    return (
      typeof child.attributes.content === "string" && child.attributes.content.trim().length > 0
    );
  });
}

const builtinTags: Record<string, Schema> = {
  callout: {
    render: "Callout",
    attributes: {
      type: {
        type: String,
        default: "note",
        matches: ["note", "tip", "warning", "error"],
      },
    },
  },
  tabs: { render: "Tabs" },
  tab: {
    render: "Tab",
    attributes: { label: { type: String, required: true } },
  },
  details: {
    render: "Details",
    attributes: {
      summary: { type: String },
      open: { type: Boolean, default: false },
    },
  },
  badge: {
    render: "Badge",
    attributes: {
      type: {
        type: String,
        default: "default",
        matches: ["default", "info", "success", "warning", "danger"],
      },
    },
  },
  kbd: { render: "Kbd" },
  math: {
    render: "Math",
    attributes: { display: { type: Boolean, default: true } },
  },
  diagram: {
    render: "Diagram",
    attributes: {
      type: { type: String, default: "mermaid", matches: ["mermaid", "d2"] },
      source: { type: String },
    },
    transform(node: Node, config: Config) {
      const attributes = node.transformAttributes(config);
      const fence = diagramFence(node);
      const lang =
        typeof fence?.attributes.language === "string" ? fence.attributes.language : undefined;
      const explicit = node.attributes.type;
      const type =
        explicit === "d2" || explicit === "mermaid"
          ? explicit
          : lang?.toLowerCase() === "d2"
            ? "d2"
            : "mermaid";
      let source: string | undefined;
      const fenceSource = fence?.attributes.content;
      const attributeSource = node.attributes.source;
      if (typeof fenceSource === "string" && fenceSource.trim()) {
        source = fenceSource;
      } else if (typeof attributeSource === "string" && attributeSource.trim()) {
        source = attributeSource;
      } else {
        const body = node.children
          .filter((child) => child.type !== "fence")
          .map(plainText)
          .join("\n")
          .trim();
        if (body) source = body;
      }
      const next: Record<string, unknown> = { ...attributes, type };
      if (source) next.source = source;
      else delete next.source;
      return new Tag("Diagram", next, []);
    },
  },
};

export function createSiteMarkdocConfig(
  extensions?: MarkdocExtensions,
  options?: { fenceTags?: "document" | "off" },
): Config {
  const fenceTags = options?.fenceTags ?? "document";
  return {
    nodes: {
      ...builtinNodes,
      ...extensions?.nodes,
      ...(extensions?.nodes?.fence ? {} : { fence: createFenceSchema(fenceTags) }),
    },
    tags: { ...builtinTags, ...extensions?.tags },
    ...(extensions?.variables ? { variables: extensions.variables } : {}),
    ...(extensions?.functions ? { functions: extensions.functions } : {}),
  };
}
