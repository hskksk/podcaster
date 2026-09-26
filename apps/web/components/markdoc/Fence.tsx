import { highlightCode } from "../../lib/site/shiki";
import { Diagram } from "./Diagram";

export async function Fence(props: {
  language?: string;
  content?: string;
  children?: string;
}) {
  const code = (props.content ?? props.children ?? "").replace(/\n$/, "");
  const lang = props.language || "plaintext";
  if (lang === "mermaid" || lang === "d2") {
    return <Diagram type={lang === "d2" ? "d2" : "mermaid"} source={code} />;
  }
  const html = await highlightCode(code, lang);
  return (
    <div
      className="not-prose my-6 overflow-hidden rounded-xl border border-border"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
