"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../lib/cn";
import type { DrillQuestion } from "../../../lib/juken/kokugo-choice/schema";
import { QuestionCard, type QuestionResult } from "./QuestionCard";

const STATUS_LABEL: Record<QuestionResult | "todo", string> = {
  todo: "未回答",
  correct: "正解",
  wrong: "不正解",
  skipped: "答えを見た",
};

export function ChoiceDrill(props: { questions: DrillQuestion[] }) {
  const { questions } = props;
  const [results, setResults] = useState<Partial<Record<string, QuestionResult>>>({});
  const [epoch, setEpoch] = useState(0);

  const done = Object.keys(results).length;
  const correct = Object.values(results).filter((result) => result === "correct").length;
  const finished = done === questions.length;

  function record(id: string, result: QuestionResult | null) {
    setResults((prev) => {
      const next = { ...prev };
      if (result) next[id] = result;
      else delete next[id];
      return next;
    });
  }

  function restart() {
    setResults({});
    setEpoch((value) => value + 1);
    window.scrollTo({ top: 0 });
  }

  return (
    <div>
      <nav
        aria-label="問題の一覧"
        className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 shadow-[var(--shadow-card)]"
      >
        <ol className="flex flex-wrap gap-1.5">
          {questions.map((question, index) => {
            const status = results[question.id] ?? "todo";
            return (
              <li key={question.id}>
                <a
                  href={`#${question.id}`}
                  aria-label={`問${index + 1}（${STATUS_LABEL[status]}）`}
                  className={cn(
                    "grid size-9 place-items-center rounded-full border text-sm font-black no-underline transition",
                    status === "todo" && "border-border bg-surface text-muted-fg hover:bg-muted",
                    status === "correct" && "border-[var(--j-study)] bg-[var(--j-study)] text-white",
                    status === "wrong" && "border-accent bg-accent text-accent-fg",
                    status === "skipped" && "border-muted-fg bg-muted text-fg",
                  )}
                >
                  {index + 1}
                </a>
              </li>
            );
          })}
        </ol>
        <p className="ml-auto text-sm font-bold text-muted-fg" aria-live="polite">
          {done} / {questions.length} 問 · 正解 {correct}
        </p>
      </nav>

      <div className="space-y-6" key={epoch}>
        {questions.map((question, index) => (
          <QuestionCard key={question.id} question={question} number={index + 1} onResult={record} />
        ))}
      </div>

      <section
        aria-live="polite"
        className="mt-8 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-center shadow-[var(--shadow-card)] sm:p-6"
      >
        {finished ? (
          <>
            <p className="text-xs font-black tracking-[0.14em] text-accent">おつかれさま</p>
            <p className="mt-1 font-serif text-3xl font-black">
              {questions.length} 問中 {correct} 問 正解
            </p>
            <p className="mt-2 text-sm text-muted-fg">
              まちがえた問題は「もう一度とく」で、消せなかった選択肢の理由をたしかめましょう。
            </p>
          </>
        ) : (
          <p className="text-sm font-bold text-muted-fg">
            あと {questions.length - done} 問。全部とくと、ここに結果が出ます。
          </p>
        )}
        <button
          type="button"
          onClick={restart}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold transition hover:bg-muted"
        >
          <RotateCcw className="size-4" />
          最初からやり直す
        </button>
      </section>
    </div>
  );
}
