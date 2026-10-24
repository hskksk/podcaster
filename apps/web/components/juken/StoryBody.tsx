import type { ReactNode } from "react";
import { parseStory, type StoryBlock } from "../../lib/juken/story";

function RichText(props: { text: string }) {
  const parts = props.text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function Block(props: { block: StoryBlock }) {
  const block = props.block;
  if (block.type === "rule") return <hr className="my-6 border-border" />;
  if (block.type === "meta") {
    const plain = block.text.replace(/\*\*/g, "");
    if (plain.includes("テキスト") || plain.includes("今日")) return null;
    return <p className="j-meta">{plain}</p>;
  }
  if (block.type === "heading") {
    return <h2 className="mt-8 font-serif text-xl font-bold">{block.text}</h2>;
  }
  if (block.type === "list") {
    return (
      <ul className="my-4 grid gap-2">
        {block.items.map((item, index) => (
          <li key={index} className="rounded-2xl border border-border bg-surface px-3 py-2 text-sm leading-relaxed">
            <RichText text={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "scene") {
    return (
      <p className="j-scene">
        <RichText text={block.text} />
      </p>
    );
  }
  if (block.type === "dialogue") {
    return (
      <div className="j-line" data-tone={block.tone}>
        <div className="j-avatar size-11 text-xl" aria-hidden>
          {block.emoji}
        </div>
        <div className="min-w-0">
          <p className="j-name">
            {block.speaker}
            {block.role ? <span className="j-role">{block.role}</span> : null}
          </p>
          <p className="j-say">{block.text}</p>
          {block.note ? <p className="j-note">{block.note}</p> : null}
        </div>
      </div>
    );
  }
  return (
    <p className="my-3 leading-relaxed">
      <RichText text={block.text} />
    </p>
  );
}

export function StoryBody(props: { source: string }) {
  const blocks = parseStory(props.source);
  const nodes: ReactNode[] = blocks.map((block, index) => (
      <Block key={index} block={block} />
  ));
  return (
    <div className="j-story" data-pagefind-body data-pagefind-filter="site:juken">
      {nodes}
    </div>
  );
}
