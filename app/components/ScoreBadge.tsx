/** Band labels for a 0-1 IntelliScent score. */
export function scoreLabel(score: number): string {
  if (score >= 0.75) return "Excellent";
  if (score >= 0.6) return "Strong";
  if (score >= 0.45) return "Worth a try";
  return "Risky";
}

/** An IntelliScent score (0-1, shown as 0-100), color-banded, with an optional text label. */
export default function ScoreBadge({ score, label }: { score: number; label?: string | null }) {
  const band = score >= 0.6 ? "high" : score >= 0.45 ? "mid" : "low";
  return (
    <span className="score-badge" data-band={band} title="IntelliScent score (0-100)">
      <strong>{Math.round(score * 100)}</strong>
      {label && <span>{label}</span>}
    </span>
  );
}
