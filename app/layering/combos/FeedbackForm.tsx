"use client";

import { useState } from "react";
import { OCCASION_QUESTION_LIMIT, type CheckinAnswer, type WearCheckins } from "@/lib/intelliscent/checkins";
import { FEEDBACK_TAGS, type FeedbackEvent, type FeedbackTag } from "@/lib/intelliscent/personalization";

type YesNo = boolean | undefined;

function YesNoToggle({ value, onChange, label }: { value: YesNo; onChange: (v: YesNo) => void; label: string }) {
  return (
    <span className="checkin-question">
      <span className="muted small">{label}</span>
      {([true, false] as const).map((v) => (
        <button
          key={String(v)}
          type="button"
          className={value === v ? "chip-toggle is-active" : "chip-toggle"}
          aria-pressed={value === v}
          onClick={() => onChange(value === v ? undefined : v)}
        >
          {v ? "Yes" : "No"}
        </button>
      ))}
    </span>
  );
}

/**
 * Log one wear of a combo: a 1-5 rating, the reason tags that tell
 * IntelliScent *which* part was off, and optional quick check-ins per
 * scent. The check-ins correct that bottle's own profile (they outweigh
 * the Fragrantica-based estimate); the occasion question is only asked the
 * first couple of times per fragrance.
 */
export default function FeedbackForm({
  fragrances,
  checkins,
  onSubmit,
  busy,
}: {
  fragrances: Array<{ id: number; name: string }>;
  checkins: Record<string, WearCheckins>;
  onSubmit: (rating: FeedbackEvent["rating"], tags: FeedbackTag[], answers: Record<number, CheckinAnswer>) => void;
  busy: boolean;
}) {
  const [rating, setRating] = useState<FeedbackEvent["rating"] | null>(null);
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [answers, setAnswers] = useState<Record<number, CheckinAnswer>>({});

  function toggleTag(tag: FeedbackTag) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  function answer(id: number, patch: CheckinAnswer) {
    setAnswers((a) => ({ ...a, [id]: { ...a[id], ...patch } }));
  }

  const occasionAsked = (id: number) => {
    const o = checkins[String(id)]?.occasion;
    return (o?.office ?? 0) + (o?.evening ?? 0) >= OCCASION_QUESTION_LIMIT;
  };

  return (
    <div className="feedback-form">
      <div className="rating-row" role="group" aria-label="Rating">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            className={rating === n ? "chip-toggle is-active" : "chip-toggle"}
            aria-pressed={rating === n}
            onClick={() => setRating(n)}
          >
            {n}
          </button>
        ))}
        <span className="muted small">1 = bad, 5 = loved it</span>
      </div>
      <div className="chip-toggle-row" role="group" aria-label="What stood out">
        {FEEDBACK_TAGS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tags.includes(t.id) ? "chip-toggle is-active" : "chip-toggle"}
            aria-pressed={tags.includes(t.id)}
            onClick={() => toggleTag(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="checkins">
        <p className="muted small">Quick check-in (optional) - teaches IntelliScent how your bottles really wear:</p>
        {fragrances.map((f) => (
          <div key={f.id} className="checkin-row">
            <strong className="small">{f.name}</strong>
            <YesNoToggle label="Still noticeable at 4h?" value={answers[f.id]?.h4} onChange={(v) => answer(f.id, { h4: v })} />
            <YesNoToggle label="At 8h?" value={answers[f.id]?.h8} onChange={(v) => answer(f.id, { h8: v })} />
            {!occasionAsked(f.id) && (
              <span className="checkin-question">
                <span className="muted small">More office or evening to you?</span>
                {(["office", "evening"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={answers[f.id]?.occasion === o ? "chip-toggle is-active" : "chip-toggle"}
                    aria-pressed={answers[f.id]?.occasion === o}
                    onClick={() => answer(f.id, { occasion: answers[f.id]?.occasion === o ? undefined : o })}
                  >
                    {o === "office" ? "Office" : "Evening"}
                  </button>
                ))}
              </span>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="button"
        disabled={rating === null || busy}
        onClick={() => {
          if (rating === null) return;
          onSubmit(rating, tags, answers);
          setRating(null);
          setTags([]);
          setAnswers({});
        }}
      >
        {busy ? "Saving…" : "Log this wear"}
      </button>
    </div>
  );
}
