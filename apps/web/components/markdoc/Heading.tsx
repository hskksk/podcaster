import type { ReactNode } from "react";
import { markdocSlugify } from "../../lib/markdoc/slugify";

function headingText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(headingText).join("");
  if (children && typeof children === "object" && "props" in children) {
    const el = children as { props?: { children?: ReactNode } };
    return headingText(el.props?.children ?? "");
  }
  return "";
}

export function Heading(props: { level: number; id?: string; children?: ReactNode }) {
  const level = Math.min(6, Math.max(1, props.level));
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  // Transform assigns `id`; fallback only for editor/preview edge cases (same rules as site-config).
  const id = props.id ?? (markdocSlugify(headingText(props.children)) || "section");
  return (
    <Tag id={id} className="markdoc-heading scroll-mt-24">
      {props.children}
    </Tag>
  );
}
