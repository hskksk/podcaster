import { buildSegments } from "../../../lib/juken/kokugo-choice/passage";

/** 本文。傍線部は下線、根拠として選ばれた箇所は蛍光ペン風に強調する。 */
export function PassageText(props: { passage: string; highlights: readonly string[] }) {
  const segments = buildSegments(props.passage, props.highlights);
  return (
    <p className="j-passage whitespace-pre-wrap">
      {segments.map((segment, index) => {
        let node: React.ReactNode = segment.text;
        if (segment.mark) node = <mark className="j-hit">{node}</mark>;
        if (segment.underline) {
          node = (
            <span className="j-ul">
              <span className="sr-only">（傍線部）</span>
              {node}
            </span>
          );
        }
        return <span key={index}>{node}</span>;
      })}
    </p>
  );
}
