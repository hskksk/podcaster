import type { HistoryEvent } from "../../../lib/juken/history-map/types";
import { fieldValue, maskText, type QuizField } from "../../../lib/juken/history-map/quiz";

type Props = {
  event: HistoryEvent;
  eventIndex: number;
  field: QuizField;
  quizMode: boolean;
  quizField: QuizField;
  quizRevealed: boolean;
  onOpenQuiz: (index: number, mode: "q" | "a") => void;
};

export function QuizFieldValue({
  event,
  eventIndex,
  field,
  quizMode,
  quizField,
  quizRevealed,
  onOpenQuiz,
}: Props) {
  const val = fieldValue(event, field);
  if (!quizMode || quizRevealed) return <>{val}</>;
  if (quizField !== field) {
    return <>{maskText(event, val, true, false, quizField)}</>;
  }
  return (
    <span className="hm-qf" onClick={(ev) => ev.stopPropagation()}>
      <button type="button" onClick={() => onOpenQuiz(eventIndex, "q")}>
        Q
      </button>
      <button type="button" onClick={() => onOpenQuiz(eventIndex, "a")}>
        A
      </button>
    </span>
  );
}