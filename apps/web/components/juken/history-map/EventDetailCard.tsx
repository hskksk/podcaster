import { primaryFigureForWho, type FigureIndex } from "../../../lib/juken/history-map/figures";
import type { QuizField } from "../../../lib/juken/history-map/quiz";
import type { HistoryAxis, HistoryEvent, HistoryMapBundle } from "../../../lib/juken/history-map/types";
import { FigurePortrait, FigureRichText } from "./FigureRichText";
import { QuizFieldValue } from "./QuizFieldValue";

export function EventDetailCard(props: {
  current: HistoryEvent | null;
  axisColor: (ax: HistoryAxis) => string;
  qText: (e: HistoryEvent, t: string) => string;
  wars: HistoryMapBundle["wars"];
  taxonomy: HistoryMapBundle["taxonomy"];
  quizMode: boolean;
  quizFields: QuizField[];
  quizRevealed: Set<number>;
  eventIndex: (e: HistoryEvent) => number;
  onOpenQuiz: (index: number, mode: "q" | "a") => void;
  figureIndex: FigureIndex;
}) {
  const { current, axisColor, qText, wars, taxonomy, quizMode, quizFields, quizRevealed, eventIndex, onOpenQuiz, figureIndex } =
    props;
  if (!current) {
    return <div className="hm-card">この条件に合う出来事は、まだありません。スライダーを右へ動かそう。</div>;
  }
  const col = axisColor(current.axis);
  const idx = eventIndex(current);
  const quizField = quizFields[idx] ?? "t";
  const revealed = quizRevealed.has(idx);
  const showWhoInitial = !quizMode || revealed || quizField !== "who" ? current.who[0] : "?";
  const portrait = !quizMode || revealed || quizField !== "who" ? primaryFigureForWho(current.who, figureIndex) : null;
  return (
    <div className="hm-card">
      <div className="hm-h">
        {portrait ? (
          <FigurePortrait fig={portrait} accent={col} />
        ) : (
          <div className="hm-av" style={{ background: col }}>
            {showWhoInitial}
          </div>
        )}
        <div>
          <b>
            <QuizFieldValue
              event={current}
              eventIndex={idx}
              field="y"
              quizMode={quizMode}
              quizField={quizField}
              quizRevealed={revealed}
              onOpenQuiz={onOpenQuiz}
            />{" "}
            <QuizFieldValue
              event={current}
              eventIndex={idx}
              field="t"
              quizMode={quizMode}
              quizField={quizField}
              quizRevealed={revealed}
              onOpenQuiz={onOpenQuiz}
            />
          </b>
          <div className="hm-mut">
            {qText(current, current.place)}　／　
            <QuizFieldValue
              event={current}
              eventIndex={idx}
              field="who"
              quizMode={quizMode}
              quizField={quizField}
              quizRevealed={revealed}
              onOpenQuiz={onOpenQuiz}
              figureIndex={figureIndex}
            />
          </div>
        </div>
      </div>
      <p>
        <FigureRichText text={qText(current, current.body)} index={figureIndex} />
      </p>
      <span className="hm-tag" style={{ background: col }}>
        {taxonomy.axes[current.axis][0]}
      </span>
      {current.axis === "w" && wars[current.title] ? (
        <div className="hm-mut">◆＝戦った主な人物のいた場所(赤と青は敵どうし)／点線の丸＝戦いのあった範囲</div>
      ) : null}
    </div>
  );
}
