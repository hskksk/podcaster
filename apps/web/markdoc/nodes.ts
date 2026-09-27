import {
  nodes as defaultNodes,
  Tag,
  type Config,
  type Node,
} from "@markdoc/markdoc";

/** Markdoc defaults `process=true` on fences (tags inside are parsed). For doc languages, treat as source quotes. */
const LITERAL_FENCE_LANGUAGES = new Set(["md", "markdown", "markdoc", "mdoc"]);

function fenceUsesLiteralContent(
  language: string | undefined,
  process: boolean | undefined,
): boolean {
  if (process === false) return true;
  if (process === true) return false;
  return language != null && LITERAL_FENCE_LANGUAGES.has(language);
}

export default {
  document: defaultNodes.document,
  paragraph: defaultNodes.paragraph,
  list: defaultNodes.list,
  item: defaultNodes.item,
  blockquote: defaultNodes.blockquote,
  hr: defaultNodes.hr,
  image: defaultNodes.image,
  table: defaultNodes.table,
  thead: defaultNodes.thead,
  tbody: defaultNodes.tbody,
  tr: defaultNodes.tr,
  th: defaultNodes.th,
  td: defaultNodes.td,
  strong: defaultNodes.strong,
  em: defaultNodes.em,
  s: defaultNodes.s,
  link: defaultNodes.link,
  code: defaultNodes.code,
  fence: {
    render: "Fence",
    attributes: defaultNodes.fence.attributes,
    transform(node: Node, config: Config) {
      const attributes = node.transformAttributes(config);
      const language = node.attributes.language as string | undefined;
      const processFlag = attributes.process as boolean | undefined;
      const literal = fenceUsesLiteralContent(language, processFlag);
      const children =
        literal || node.children.length === 0
          ? [node.attributes.content]
          : node.transformChildren(config);
      return new Tag("Fence", attributes, children);
    },
  },
  heading: {
    render: "Heading",
    attributes: {
      level: { type: Number, required: true },
      id: { type: String },
    },
  },
};
