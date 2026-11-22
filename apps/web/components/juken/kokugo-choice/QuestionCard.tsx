"use client";

import { Check, Eye, Highlighter, ListChecks, RotateCcw, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "../../../lib/cn";
import {
  CHOICE_IDS,
  ERROR_TYPE_LABELS,
  LEVEL_LABELS,
  type ChoiceId,
  type DrillQuestion,
} from "../../../lib/juken/kokugo-choice/schema";
import { PassageText } from "./PassageText";

export type QuestionResult = "correct" | "wrong" | "skipped";

export function QuestionCard(props: {
  question: DrillQuestion;
  number: number;
  onResult: (id: string, result: QuestionResult | null) => void;
}) {
  const { question } = props;
  const name = useId();
  const passageRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ChoiceId | null>(null);
  const [eliminated, setEliminated] = useState<ReadonlySet<ChoiceId>>(new Set());
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [focused, setFocused] = useState<ChoiceId | null>(null);
  const revealed = result !== null;

  function choose(id: ChoiceId) {
    setSelected(id);
    setEliminated((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleEliminated(id: ChoiceId) {
    setEliminated((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (selected === id) setSelected(null);
  }

  function reveal(skipped: boolean) {
    const next: QuestionResult = skipped || !selected ? "skipped" : selected === question.answer ? "correct" : "wrong";
    setResult(next);
    props.onResult(question.id, next);
  }

  function reset() {
    setSelected(null);
    setEliminated(new Set());
    setResult(null);
    setFocused(null);
    props.onResult(question.id, null);
  }

  function showEvidence(id: ChoiceId) {
    const next = focused === id ? null : id;
    setFocused(next);
    if (next) {
      const box = passageRef.current;
      if (box) {
        const rect = box.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight) {
          const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          box.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
        }
      }
    }
  }

  const highlights = focused ? question.analysis[focused].evidence : [];

  return (
    <section
      id={question.id}
      aria-labelledby={`${name}-title`}
      className="scroll-mt-24 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 id={`${name}-title`} className="mr-1 font-serif text-xl font-black">
          問{props.number}
        </h2>
        <span className="j-chip">{question.genre}</span>
        <span className="j-chip">{LEVEL_LABELS[question.level]}</span>
        <span className="j-chip">{question.questionType}</span>
      </header>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-7">
        <div ref={passageRef} className="scroll-mt-24 self-start lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-[color-mix(in_srgb,var(--color-muted)_45%,var(--color-surface))] px-4 py-3.5">
            <PassageText passage={question.passage} highlights={highlights} />
            <p className="mt-3 text-right text-xs font-bold text-muted-fg">出典：{question.source}</p>
          </div>
        </div>

        <div>
          <p className="font-bold leading-relaxed">{question.question}</p>
          <div role="radiogroup" aria-label={`問${props.number}の選択肢`} className="mt-3 grid gap-2.5">
            {CHOICE_IDS.map((id) => {
              const info = question.analysis[id];
              const isSelected = selected === id;
              const isEliminated = eliminated.has(id);
              const state = revealed
                ? info.correct
                  ? "correct"
                  : isSelected
                    ? "wrong"
                    : "plain"
                : "plain";
              return (
                <div key={id} className="grid gap-2">
                  <div className="flex items-stretch gap-2">
                    <label
                      className={cn(
                        "flex min-w-0 flex-1 items-start gap-3 rounded-2xl border px-3 py-2.5 transition",
                        "has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                        revealed ? "cursor-default" : "cursor-pointer",
                        state === "correct" &&
                          "border-[var(--j-study)] bg-[color-mix(in_srgb,var(--j-study)_14%,var(--color-surface))]",
                        state === "wrong" &&
                          "border-accent bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-surface))]",
                        state === "plain" && "border-border bg-surface",
                        state === "plain" && !revealed && !isSelected && "hover:bg-muted",
                        state === "plain" &&
                          !revealed &&
                          isSelected &&
                          "border-accent bg-[color-mix(in_srgb,var(--color-accent)_9%,var(--color-surface))] ring-2 ring-accent/30",
                        isEliminated && !revealed && "opacity-55",
                      )}
                    >
                      <input
                        type="radio"
                        name={name}
                        value={id}
                        checked={isSelected}
                        disabled={revealed}
                        onChange={() => choose(id)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 grid size-7 flex-none place-items-center rounded-full border text-sm font-black",
                          state === "correct" && "border-[var(--j-study)] bg-[var(--j-study)] text-white",
                          state === "wrong" && "border-accent bg-accent text-accent-fg",
                          state === "plain" && !revealed && isSelected && "border-accent bg-accent text-accent-fg",
                          state === "plain" && !(!revealed && isSelected) && "border-border bg-muted",
                        )}
                      >
                        {id}
                      </span>
                      <span className={cn("min-w-0 leading-relaxed", isEliminated && "line-through decoration-2")}>
                        {question.choices[id]}
                      </span>
                    </label>
                    <button
                      type="button"
                      aria-pressed={isEliminated}
                      aria-label={`${id}を消す`}
                      title="まちがいだと思ったら消す"
                      disabled={revealed}
                      onClick={() => toggleEliminated(id)}
                      className={cn(
                        "grid w-11 flex-none place-items-center rounded-2xl border transition",
                        "disabled:cursor-default disabled:opacity-40",
                        isEliminated
                          ? "border-accent bg-accent text-accent-fg"
                          : "border-border bg-surface text-muted-fg hover:bg-muted hover:text-fg",
                      )}
                    >
                      <X className="size-5" strokeWidth={2.5} />
                    </button>
                  </div>

                  {revealed ? (
                    <ChoiceReview
                      id={id}
                      info={info}
                      selected={isSelected}
                      active={focused === id}
                      onShowEvidence={() => showEvidence(id)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {!revealed ? (
            <div className="mt-4">
              <p className="mb-3 text-xs leading-relaxed text-muted-fg">
                右の <X className="inline size-3.5 align-[-2px]" strokeWidth={3} /> で、まちがいだと思う選択肢を消せます。消せなかった理由を本文で探しましょう。
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!selected}
                  onClick={() => reveal(false)}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-black text-accent-fg shadow-[var(--shadow-card)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Check className="size-4" strokeWidth={3} />
                  答え合わせ
                </button>
                <button
                  type="button"
                  onClick={() => reveal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-muted-fg transition hover:bg-muted hover:text-fg"
                >
                  <Eye className="size-4" />
                  答えだけ見る
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4" aria-live="polite">
              <ResultBanner result={result} answer={question.answer} />
              <div className="rounded-2xl border border-border bg-muted/60 px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs font-black tracking-[0.1em] text-[var(--j-study)]">
                  <ListChecks className="size-4" />
                  消去法の手順
                </p>
                <p className="mt-1.5 text-sm leading-relaxed">{question.eliminationSteps}</p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold transition hover:bg-muted"
              >
                <RotateCcw className="size-4" />
                もう一度とく
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ResultBanner(props: { result: QuestionResult | null; answer: ChoiceId }) {
  const correct = props.result === "correct";
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-2xl px-4 py-3 font-black",
        correct
          ? "bg-[color-mix(in_srgb,var(--j-study)_18%,var(--color-surface))] text-[color-mix(in_srgb,var(--j-study)_75%,var(--color-fg))]"
          : "bg-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-surface))] text-accent",
      )}
    >
      {correct ? <Check className="size-5" strokeWidth={3} /> : <X className="size-5" strokeWidth={3} />}
      {props.result === "correct"
        ? "正解です"
        : props.result === "wrong"
          ? `ざんねん。正解は「${props.answer}」です`
          : `正解は「${props.answer}」です`}
    </p>
  );
}

function ChoiceReview(props: {
  id: ChoiceId;
  info: DrillQuestion["analysis"][ChoiceId];
  selected: boolean;
  active: boolean;
  onShowEvidence: () => void;
}) {
  const { info } = props;
  return (
    <div className="ml-3 border-l-4 border-border pl-3.5 text-sm leading-relaxed">
      <p className="flex flex-wrap items-center gap-2 font-black">
        {info.correct ? (
          <span className="text-[color-mix(in_srgb,var(--j-study)_75%,var(--color-fg))]">○ 正しい</span>
        ) : (
          <>
            <span className="text-accent">× まちがい</span>
            {info.errorType ? <span className="j-chip">{ERROR_TYPE_LABELS[info.errorType]}</span> : null}
          </>
        )}
        {props.selected ? <span className="j-chip">あなたの答え</span> : null}
      </p>
      {info.defect ? <p className="mt-1">{info.defect}</p> : null}
      <div className="mt-1.5 flex flex-wrap items-start gap-2">
        <ul className="min-w-0 flex-1 space-y-1">
          {info.evidence.map((quote) => (
            <li key={quote} className="text-muted-fg">
              <span className="font-bold">本文：</span>「{quote}」
            </li>
          ))}
        </ul>
        <button
          type="button"
          aria-pressed={props.active}
          onClick={props.onShowEvidence}
          className={cn(
            "inline-flex flex-none items-center gap-1 rounded-full border px-3 py-1 text-xs font-black transition",
            props.active
              ? "border-transparent bg-[var(--j-hit-bg)] text-[var(--color-fg)]"
              : "border-border bg-surface hover:bg-muted",
          )}
        >
          <Highlighter className="size-3.5" />
          本文で見る
        </button>
      </div>
    </div>
  );
}
