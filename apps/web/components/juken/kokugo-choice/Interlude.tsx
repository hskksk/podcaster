import type { RenderableTreeNodes } from "@markdoc/markdoc";
import { JukenMarkdocBody } from "../JukenMarkdocBody";

/** 問題のあいだの休けい。ぬいぐるみたちが好きなことを話したり、遊んだりしている。 */
export function Interlude(props: { content: RenderableTreeNodes }) {
  return (
    <aside
      aria-label="ひとやすみ"
      className="rounded-[var(--radius-card)] border-2 border-dashed border-border bg-[color-mix(in_srgb,var(--color-muted)_55%,transparent)] px-4 py-3 sm:px-6"
    >
      <p className="text-xs font-black tracking-[0.14em] text-[var(--j-study)]">ひとやすみ</p>
      <JukenMarkdocBody content={props.content} cast={{}} />
    </aside>
  );
}
