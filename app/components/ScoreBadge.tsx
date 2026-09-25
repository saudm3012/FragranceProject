/** A 0-100 IntelliScent score, color-banded, with an optional text label. */
export default function ScoreBadge({ score, label }: { score: number; label?: string | null }) {
  const band = score >= 65 ? "high" : score >= 45 ? "mid" : "low";
  return (
    <span className="score-badge" data-band={band} title="IntelliScent score (0-100)">
      <strong>{score}</strong>
      {label && <span>{label}</span>}
    </span>
  );
}
