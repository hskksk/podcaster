export function QuizToggleButtons(props: {
  quizMode: boolean;
  compact?: boolean;
  onToggle: () => void;
  onShuffle: () => void;
}) {
  const { quizMode, compact, onToggle, onShuffle } = props;
  const label = compact ? (quizMode ? "🎯 クイズ中" : "🎯 クイズ") : quizMode ? "🎯 クイズ中(もどる)" : "🎯 クイズモード";
  return (
    <>
      <button type="button" className="hm-btn" onClick={onToggle}>
        {label}
      </button>
      {quizMode ? (
        <button type="button" className="hm-btn" onClick={onShuffle} aria-label="出題を入れ替える">
          🔀
        </button>
      ) : null}
    </>
  );
}
