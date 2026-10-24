import { prepareJukenMarkdoc } from "../../lib/juken/prepare";
import type { LessonCast } from "../../lib/juken/lesson-meta";
import { JukenMarkdocBody } from "./JukenMarkdocBody";

export function StoryBody(props: { source: string; cast: LessonCast }) {
  const { content } = prepareJukenMarkdoc(props.source);
  return (
    <div className="j-story" data-pagefind-body data-pagefind-filter="site:juken">
      <JukenMarkdocBody content={content} cast={props.cast} />
    </div>
  );
}
