import Link from "next/link";
import { QuizToggleButtons } from "../QuizToggleButtons";

export function MobileTopBar(props: {
  title: string;
  quizMode: boolean;
  onToggleQuiz: () => void;
  onShuffleQuiz: () => void;
}) {
  const { title, quizMode, onToggleQuiz, onShuffleQuiz } = props;
  return (
    <header className="hm-top">
      <div className="hm-row">
        <Link href="/juken" className="hm-back" aria-label="ふしぎ旅へ戻る">
          ←
        </Link>
        <h1>🗾 {title}</h1>
        <QuizToggleButtons quizMode={quizMode} compact onToggle={onToggleQuiz} onShuffle={onShuffleQuiz} />
      </div>
    </header>
  );
}
