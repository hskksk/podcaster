import { nodes as defaultNodes } from "@markdoc/markdoc";

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
  },
  heading: {
    render: "Heading",
    attributes: {
      level: { type: Number, required: true },
      id: { type: String },
    },
  },
};
