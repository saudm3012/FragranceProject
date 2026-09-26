/**
 * Confidence bands for a 0-1 IntelliScent score, highest first. Lower
 * bands are shown collapsed in result lists, so dipping into them is a
 * deliberate choice rather than something presented as equally confident.
 */
export const SCORE_BANDS = [
  { id: "excellent", label: "Excellent", min: 0.55, collapsed: false },
  { id: "good", label: "Good", min: 0.45, collapsed: false },
  { id: "try", label: "Worth trying", min: 0.35, collapsed: true },
  { id: "risky", label: "Risky", min: 0, collapsed: true },
] as const;
export type ScoreBand = (typeof SCORE_BANDS)[number];

export function bandOf(score: number): ScoreBand {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

export function scoreLabel(score: number): string {
  return bandOf(score).label;
}

/** An IntelliScent score (0-1, shown as 0-100), colored by band, with an optional text label. */
export default function ScoreBadge({ score, label }: { score: number; label?: string | null }) {
  return (
    <span className="score-badge" data-band={bandOf(score).id} title="IntelliScent score (0-100)">
      <strong>{Math.round(score * 100)}</strong>
      {label && <span>{label}</span>}
    </span>
  );
}
