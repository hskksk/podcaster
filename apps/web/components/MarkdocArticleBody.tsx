import dynamic from "next/dynamic";
import type { RenderableTreeNodes } from "@markdoc/markdoc";

const MarkdocContent = dynamic(
  () => import("./MarkdocContent").then((mod) => mod.MarkdocContent),
  { ssr: true },
);

/** Server pages pass a prepared tree; heavy client deps load in a separate chunk. */
export function MarkdocArticleBody({ content }: { content: RenderableTreeNodes }) {
  return <MarkdocContent content={content} />;
}
