"use client";

import type { ReactNode } from "react";
import FragranceChip from "@/app/components/FragranceChip";
import ScoreBadge, { scoreLabel } from "@/app/components/ScoreBadge";
import type { ComboSnapshot } from "@/lib/client/localCombos";
import type { Role } from "@/lib/intelliscent/engine";
import type { Fragrance } from "@/lib/schemas";

// Typed as a full Record so a new Role forces a label here.
const ROLE_LABELS: Record<Role, string> = { anchor: "Anchor", modifier: "Modifier", accent: "Accent" };

const TERMS: ReadonlyArray<{ key: keyof ComboSnapshot["terms"]; label: string; hint: string }> = [
  { key: "harmony", label: "Harmony", hint: "Do the accord families traditionally play well together?" },
  { key: "structure", label: "Structure", hint: "Is there one clear base-heavy anchor, with the rest lighter?" },
  { key: "interest", label: "Interest", hint: "Different enough to add something, close enough to cohere?" },
  { key: "context", label: "Context", hint: "Fit with your season / time / occasion filter." },
];

function TermBar({ label, hint, value }: { label: string; hint: string; value: number }) {
  return (
    <div className="term-row" title={hint}>
      <span className="term-label">{label}</span>
      <div className="term-track" aria-hidden="true">
        <div className="term-fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="term-value">{Math.round(value * 100)}</span>
    </div>
  );
}

/**
 * One IntelliScent result - live or saved - with its roles, score, blend
 * description, the "why" breakdown and the recipe. Used by suggestions,
 * combo match and the combo journal so they always read the same way.
 */
export default function ComboResultView({
  result,
  getFragrance,
  collectionIds,
  actions,
  detailsOpen = false,
}: {
  result: ComboSnapshot;
  getFragrance: (id: number) => Fragrance | undefined;
  collectionIds: ReadonlySet<number>;
  actions?: ReactNode;
  detailsOpen?: boolean;
}) {
  const stepById = new Map(result.recipe.steps.map((s) => [s.fragranceId, s]));
  const nameOf = (id: number) => getFragrance(id)?.name ?? `#${id}`;

  return (
    <div className="combo-result">
      <div className="combo-result-header">
        <ScoreBadge score={result.score} label={scoreLabel(result.score)} />
        {actions && <div className="combo-result-actions">{actions}</div>}
      </div>

      <div className="combo-layers">
        {result.fragranceIds.map((id, i) => {
          const f = getFragrance(id);
          const step = stepById.get(id);
          return (
            <div key={id} className="combo-member">
              <span className={`role-tag role-${result.roles[i]}`}>{ROLE_LABELS[result.roles[i]]}</span>
              <FragranceChip
                name={f?.name ?? "Loading…"}
                brand={f?.brand}
                imageUrl={f?.imageUrl}
                inCollection={collectionIds.has(id)}
                trailing={step ? <span className="muted">{step.sprays} spray{step.sprays === 1 ? "" : "s"}</span> : null}
              />
            </div>
          );
        })}
      </div>

      <p className="blend-description">{result.recipe.description}</p>

      <details className="combo-details" open={detailsOpen}>
        <summary>Why this score</summary>
        {TERMS.map((t) =>
          result.terms[t.key] === null ? null : (
            <TermBar key={t.key} label={t.label} hint={t.hint} value={result.terms[t.key] as number} />
          )
        )}
        {result.terms.context === null && <p className="muted small">No context filter set, so context isn&apos;t scored.</p>}
        {result.structureNote && <p className="muted small">{result.structureNote}</p>}
        {result.penalties.length > 0 && (
          <ul className="penalty-list">
            {result.penalties.map((p, i) => (
              <li key={i}>
                <strong>−{Math.round(p.amount * 100)}</strong> {p.detail}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="combo-details" open={detailsOpen}>
        <summary>How to wear it</summary>
        <ol className="recipe-steps">
          {result.recipe.steps.map((s) => (
            <li key={s.fragranceId}>
              <strong>
                {nameOf(s.fragranceId)} · {s.sprays} spray{s.sprays === 1 ? "" : "s"}
              </strong>
              <span className="muted">{s.placement}</span>
            </li>
          ))}
        </ol>
        <p className="muted small">{result.recipe.skinTest}</p>
      </details>
    </div>
  );
}
