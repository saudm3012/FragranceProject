"use client";

import { Fragment, useMemo, useState } from "react";
import FragranceChip from "@/app/components/FragranceChip";
import FragrancePicker from "@/app/components/FragrancePicker";
import ScoreBadge from "@/app/components/ScoreBadge";
import type { IntelliScentActionProps } from "@/app/layering/intelliscent/types";
import { rateCombo } from "@/lib/client/api";
import { useCombos, useFragrances } from "@/lib/client/hooks";
import { addCombo, comboKey } from "@/lib/client/localCombos";
import type { RateResponse } from "@/lib/intelliscent/types";
import type { Fragrance } from "@/lib/schemas";

export default function ComboMatchPanel({
  base,
  params,
  username,
  collection,
  collectionIds,
  goToTab,
}: IntelliScentActionProps) {
  const [layerIds, setLayerIds] = useState<number[]>([]); // scents added on top of the base
  const [rated, setRated] = useState<{ key: string; response: RateResponse } | null>(null);
  const [rating, setRating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => [base.id, ...layerIds], [base.id, layerIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const { get } = useFragrances(selectedIds);
  const combos = useCombos(username);

  // A rating belongs to a specific set of scents + settings; if either
  // changes afterwards, it's shown as outdated rather than silently wrong.
  const currentKey = `${comboKey(selectedIds)}|${JSON.stringify(params)}`;
  const isStale = rated != null && rated.key !== currentKey;
  const canRate = layerIds.length > 0;
  const saved = combos.some((c) => comboKey(c.fragranceIds) === comboKey(selectedIds));

  function addLayer(f: Fragrance) {
    const id = f.id;
    if (id == null || id === base.id) return;
    setLayerIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }

  function removeLayer(id: number) {
    setLayerIds((ids) => ids.filter((x) => x !== id));
  }

  async function handleRate() {
    const key = currentKey;
    setRating(true);
    setError(null);
    try {
      setRated({ key, response: await rateCombo({ fragranceIds: selectedIds, params }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRating(false);
    }
  }

  function handleSave() {
    const fresh = rated && !isStale ? rated.response : null;
    addCombo(username, {
      fragranceIds: selectedIds,
      source: "match",
      score: fresh?.rating.score ?? null,
      scoreLabel: fresh?.rating.label ?? null,
      params: fresh?.params ?? params,
    });
  }

  function nameOf(id: number): string {
    return get(id)?.name ?? `#${id}`;
  }

  return (
    <div className="action-panel">
      <h3 className="panel-heading">Your combo</h3>
      <div className="combo-layers">
        {selectedIds.map((id, i) => {
          const f = get(id);
          const isBase = id === base.id;
          return (
            <Fragment key={id}>
              {i > 0 && (
                <span className="combo-plus" aria-hidden="true">
                  +
                </span>
              )}
              <FragranceChip
                name={f?.name ?? "Loading…"}
                brand={f?.brand}
                imageUrl={f?.imageUrl}
                inCollection={collectionIds.has(id)}
                trailing={
                  isBase ? (
                    <span className="muted">Base</span>
                  ) : (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => removeLayer(id)}
                      aria-label={`Remove ${f?.name ?? "fragrance"}`}
                    >
                      remove
                    </button>
                  )
                }
              />
            </Fragment>
          );
        })}
      </div>
      {!canRate && <p className="muted">Add at least one scent below to rate the combo.</p>}

      <div className="button-row-inline">
        <button type="button" className="button button-primary" onClick={handleRate} disabled={!canRate || rating}>
          {rating ? "Rating…" : "Rate combo"}
        </button>
        <button type="button" className="button" onClick={handleSave} disabled={!canRate || saved}>
          {saved ? "Saved" : "Save to My Combos"}
        </button>
        {saved && (
          <button type="button" className="link-button" onClick={() => goToTab("combos")}>
            View in My Combos
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {rated && (
        <div className={isStale ? "rating-result is-stale" : "rating-result"}>
          <ScoreBadge score={rated.response.rating.score} label={rated.response.rating.label} />
          {isStale && <p className="muted">Outdated - the scents or settings changed. Rate again to update.</p>}
          {rated.response.rating.pairs.length > 1 && (
            <ul className="pair-list">
              {rated.response.rating.pairs.map((p) => (
                <li key={`${p.aId}-${p.bId}`}>
                  <span>
                    {nameOf(p.aId)} + {nameOf(p.bId)}
                  </span>
                  <ScoreBadge score={p.score} />
                </li>
              ))}
            </ul>
          )}
          {rated.response.algorithm.isPlaceholder && (
            <p className="muted algo-meta">Placeholder scoring until the real IntelliScent algorithm lands.</p>
          )}
        </div>
      )}

      <h3 className="panel-heading">Add a scent</h3>
      <FragrancePicker collection={collection} excludeIds={selectedSet} onPick={addLayer} />
    </div>
  );
}
