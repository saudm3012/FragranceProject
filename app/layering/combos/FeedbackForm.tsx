"use client";

import { useState } from "react";
import { FEEDBACK_TAGS, type FeedbackEvent, type FeedbackTag } from "@/lib/intelliscent/personalization";

/** Log one wear of a combo: a 1-5 rating plus the reason tags that tell IntelliScent *which* part was off. */
export default function FeedbackForm({
  onSubmit,
  busy,
}: {
  onSubmit: (rating: FeedbackEvent["rating"], tags: FeedbackTag[]) => void;
  busy: boolean;
}) {
  const [rating, setRating] = useState<FeedbackEvent["rating"] | null>(null);
  const [tags, setTags] = useState<FeedbackTag[]>([]);

  function toggle(tag: FeedbackTag) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

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
            onClick={() => toggle(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="button"
        disabled={rating === null || busy}
        onClick={() => {
          if (rating === null) return;
          onSubmit(rating, tags);
          setRating(null);
          setTags([]);
        }}
      >
        {busy ? "Saving…" : "Log this wear"}
      </button>
    </div>
  );
}
