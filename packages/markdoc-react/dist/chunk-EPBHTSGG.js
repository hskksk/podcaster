import Markdoc from '@markdoc/markdoc';

// src/text.ts
function childText(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(childText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = node.props;
    return childText(props?.children);
  }
  return "";
}
function isReactElement(node) {
  return typeof node === "object" && node !== null && "props" in node;
}
function childDiagramSource(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    if (node.some(isReactElement)) {
      return node.map(childDiagramSource).map((value) => value.trimEnd()).filter((value) => value.length > 0).join("\n");
    }
    let output = "";
    for (const child of node) {
      if (typeof child === "string") {
        output += child === " " ? "\n" : child;
      } else {
        output += childDiagramSource(child);
      }
    }
    return output;
  }
  if (isReactElement(node)) return childDiagramSource(node.props?.children);
  return "";
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}
function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var { Tag, nodes: defaultNodes } = Markdoc;
var LITERAL_FENCE_LANGUAGES = /* @__PURE__ */ new Set(["md", "markdown", "markdoc", "mdoc"]);
var headingIds = /* @__PURE__ */ new WeakMap();
function resetHeadingIds(config) {
  headingIds.set(config, /* @__PURE__ */ new Set());
}
function uniqueHeadingId(base, config) {
  let used = headingIds.get(config);
  if (!used) {
    used = /* @__PURE__ */ new Set();
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
function renderableText(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((child) => renderableText(child)).join("");
  if (value && typeof value === "object" && "children" in value) return renderableText(value.children);
  return "";
}
function fenceUsesLiteralContent(language, process) {
  if (process === false) return true;
  if (process === true) return false;
  return language != null && LITERAL_FENCE_LANGUAGES.has(language);
}
function fenceHasTags(node) {
  return node.children.some((child) => child.type === "tag");
}
var document = {
  ...defaultNodes.document,
  transform(node, config) {
    resetHeadingIds(config);
    return new Tag(
      defaultNodes.document.render ?? "article",
      node.transformAttributes(config),
      node.transformChildren(config)
    );
  }
};
function createFenceSchema(mode) {
  return {
    render: "CodeFence",
    attributes: defaultNodes.fence.attributes,
    transform(node, config) {
      const attributes = node.transformAttributes(config);
      const language = typeof node.attributes.language === "string" ? node.attributes.language : void 0;
      const processFlag = node.attributes.process;
      const content = typeof node.attributes.content === "string" ? node.attributes.content : void 0;
      const literal = mode === "off" || fenceUsesLiteralContent(language, processFlag);
      const processed = !literal && fenceHasTags(node);
      const children = processed ? node.transformChildren(config) : content == null ? [] : [content];
      return new Tag("CodeFence", { ...attributes, language, content, processed }, children);
    }
  };
}
var fence = createFenceSchema("document");
var heading = {
  render: "Heading",
  attributes: {
    level: { type: Number, required: true },
    id: { type: String }
  },
  transform(node, config) {
    const attributes = node.transformAttributes(config);
    const children = node.transformChildren(config);
    const explicit = typeof node.attributes.id === "string" ? node.attributes.id.trim() : "";
    const base = explicit || slugify(renderableText(children));
    const id = base ? uniqueHeadingId(base, config) : void 0;
    const next = { ...attributes, level: node.attributes.level };
    if (id) next.id = id;
    else delete next.id;
    return new Tag("Heading", next, children);
  }
};
var table = {
  ...defaultNodes.table,
  transform(node, config) {
    const children = node.transformChildren(config);
    return new Tag("div", { class: "markdoc-table-wrap" }, [new Tag("table", {}, children)]);
  }
};
var builtinNodes = {
  ...defaultNodes,
  document,
  fence,
  heading,
  table
};

// src/config/blockSource.ts
function plainText(node) {
  if (node.type === "text" || node.type === "code") {
    return typeof node.attributes.content === "string" ? node.attributes.content : "";
  }
  if (node.type === "softbreak" || node.type === "hardbreak") return "\n";
  return node.children.map(plainText).join("");
}
function firstContentFence(node) {
  return node.children.find((child) => {
    if (child.type !== "fence") return false;
    return typeof child.attributes.content === "string" && child.attributes.content.trim().length > 0;
  });
}
function resolveBlockSource(node) {
  const fence2 = firstContentFence(node);
  const fenceSource = fence2?.attributes.content;
  const attributeSource = node.attributes.source;
  if (typeof fenceSource === "string" && fenceSource.trim()) {
    return fenceSource;
  }
  if (typeof attributeSource === "string" && attributeSource.trim()) {
    return attributeSource;
  }
  const body = node.children.filter((child) => child.type !== "fence").map(plainText).join("\n").trim();
  return body || void 0;
}

// src/config/tags.ts
var { Tag: Tag2 } = Markdoc;
var callout = {
  render: "Callout",
  attributes: {
    type: {
      type: String,
      default: "note",
      matches: ["note", "tip", "warning", "error"]
    }
  }
};
var tabs = {
  render: "Tabs"
};
var tab = {
  render: "Tab",
  attributes: {
    label: { type: String, required: true }
  }
};
var details = {
  render: "Details",
  attributes: {
    summary: { type: String },
    open: { type: Boolean, default: false }
  }
};
var badge = {
  render: "Badge",
  attributes: {
    type: {
      type: String,
      default: "default",
      matches: ["default", "info", "success", "warning", "danger"]
    }
  }
};
var kbd = {
  render: "Kbd"
};
var math = {
  render: "Math",
  attributes: {
    display: { type: Boolean, default: true }
  }
};
var diagram = {
  render: "Diagram",
  attributes: {
    type: { type: String, default: "mermaid", matches: ["mermaid", "d2"] },
    source: { type: String }
  },
  transform(node, config) {
    const attributes = node.transformAttributes(config);
    const fence2 = firstContentFence(node);
    const lang = typeof fence2?.attributes.language === "string" ? fence2.attributes.language : void 0;
    const explicit = node.attributes.type;
    const type = explicit === "d2" || explicit === "mermaid" ? explicit : lang?.toLowerCase() === "d2" ? "d2" : "mermaid";
    const source = resolveBlockSource(node);
    const next = { ...attributes, type };
    if (source) next.source = source;
    else delete next.source;
    return new Tag2("Diagram", next, []);
  }
};
function jsonBlockTag(name) {
  return {
    render: name,
    attributes: {
      engine: { type: String, required: true },
      source: { type: String },
      height: { type: String }
    },
    transform(node, config) {
      const attributes = node.transformAttributes(config);
      const source = resolveBlockSource(node);
      const next = { ...attributes };
      if (source) next.source = source;
      else delete next.source;
      return new Tag2(name, next, []);
    }
  };
}
var chart = {
  ...jsonBlockTag("Chart"),
  attributes: {
    engine: { type: String, required: true, matches: ["echarts", "vega-lite"] },
    source: { type: String },
    height: { type: String }
  }
};
var graph = {
  ...jsonBlockTag("Graph"),
  attributes: {
    engine: { type: String, required: true, matches: ["cytoscape"] },
    source: { type: String },
    height: { type: String }
  }
};
var builtinTags = {
  callout,
  tabs,
  tab,
  details,
  badge,
  kbd,
  math,
  diagram,
  chart,
  graph
};

// src/config/createConfig.ts
function createMarkdocConfig(extensions, options) {
  const fenceTags = options?.fenceTags ?? "document";
  return {
    nodes: {
      ...builtinNodes,
      ...extensions?.nodes,
      // Markdoc clones the config object during transform, so the mode has to
      // live in the fence schema itself. A caller-supplied fence node is a
      // site override and keeps its own transform.
      ...extensions?.nodes?.fence ? {} : { fence: createFenceSchema(fenceTags) }
    },
    tags: { ...builtinTags, ...extensions?.tags },
    ...extensions?.variables ? { variables: extensions.variables } : {},
    ...extensions?.functions ? { functions: extensions.functions } : {}
  };
}

export { builtinNodes, builtinTags, childDiagramSource, childText, createFenceSchema, createMarkdocConfig, escapeHtml, slugify, toErrorMessage };
//# sourceMappingURL=chunk-EPBHTSGG.js.map
//# sourceMappingURL=chunk-EPBHTSGG.js.map