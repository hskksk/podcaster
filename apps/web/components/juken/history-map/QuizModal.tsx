"use client";

import { useMemo, useState } from "react";
import type { HistoryEvent } from "../../../lib/juken/history-map/types";
import { fieldValue, maskText, type QuizField } from "../../../lib/juken/history-map/quiz";

type Props = {
  modal: { index: number; mode: "q" | "a" } | null;
  events: HistoryEvent[];
  quizFields: QuizField[];
  quizRevealed: Set<number>;
  onClose: () => void;
  onReveal: (index: number) => void;
  qText: (e: HistoryEvent, t: string) => string;
};

export function QuizModal({ modal, events, quizFields, quizRevealed, onClose, onReveal, qText }: Props) {
  const payload = useMemo(() => {
    if (!modal) return null;
    const e = events[modal.index];
    if (!e) return null;
    const field = quizFields[modal.index]!;
    const lab = { y: "年号", t: "出来事の名前", who: "登場人物" }[field];
    const ans = fieldValue(e, field);
    const revealed = quizRevealed.has(modal.index);
    const mask = (t: string) => maskText(e, t, true, revealed, field);
    return { e, field, lab, ans, mask, mode: modal.mode, index: modal.index };
  }, [modal, events, quizFields, quizRevealed]);

  if (!payload) return null;

  const { e, field, lab, ans, mask, mode, index } = payload;

  return (
    <div className="hm-qp open" onClick={onClose} role="presentation">
      <div className="hm-qb" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal aria-labelledby="hm-quiz-title">
        <div className="hm-qh" id="hm-quiz-title">
          {mode === "q" ? "Q" : "A"}. この出来事の{lab}は?
        </div>
        <div className="hm-mut">
          {[field !== "y" ? `${e.year}年` : "", field !== "t" ? mask(e.title) : "", field !== "who" ? mask(e.who) : ""]
            .filter(Boolean)
            .join("／")}
        </div>
        <div style={{ margin: "6px 0" }}>{qText(e, e.body)}</div>
        {mode === "a" ? (
          <>
            <div className="hm-qa">{ans}</div>
            <button type="button" className="hm-btn" onClick={onClose}>
              閉じる
            </button>
          </>
        ) : (
          <QuizChoices
            key={index}
            event={e}
            field={field}
            answer={ans}
            events={events}
            onReveal={() => onReveal(index)}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function QuizChoices(props: {
  event: HistoryEvent;
  field: QuizField;
  answer: string;
  events: HistoryEvent[];
  onReveal: () => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const options = useMemo(() => {
    const sc = (o: HistoryEvent) => Math.abs(o.year - props.event.year) + (o.axis === props.event.axis ? 0 : 25);
    const ops = [props.answer];
    const seen = new Set(ops);
    for (const o of [...props.events].filter((x) => x !== props.event).sort((a, b) => sc(a) - sc(b))) {
      const v = fieldValue(o, props.field);
      if (!seen.has(v)) {
        seen.add(v);
        ops.push(v);
        if (ops.length >= 4) break;
      }
    }
    return ops.sort(() => Math.random() - 0.5);
  }, [props.answer, props.event, props.events, props.field]);

  return (
    <>
      {options.map((v) => (
        <button
          key={v}
          type="button"
          className={`hm-btn hm-op${picked ? (v === props.answer ? " ok" : v === picked ? " ng" : "") : ""}`}
          disabled={picked !== null}
          onClick={() => {
            setPicked(v);
            if (v === props.answer) props.onReveal();
          }}
        >
          {v}
        </button>
      ))}
      <div className="hm-qh">{picked ? (picked === props.answer ? "⭕ 正解!" : "❌ ざんねん、答えは緑の選択肢") : ""}</div>
      <button type="button" className="hm-btn" style={{ marginTop: 8 }} onClick={props.onClose}>
        閉じる
      </button>
    </>
  );
}