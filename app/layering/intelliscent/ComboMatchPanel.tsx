"use client";

import { Fragment, useMemo, useState } from "react";
import ComboResultView from "@/app/components/ComboResultView";
import FragranceChip from "@/app/components/FragranceChip";
import FragrancePicker from "@/app/components/FragrancePicker";
import type { IntelliScentActionProps } from "@/app/layering/intelliscent/types";
import { rateCombo } from "@/lib/client/api";
import * as fragranceCache from "@/lib/client/fragranceCache";
import { useCombos, useFragrances } from "@/lib/client/hooks";
import { addCombo, comboKey, snapshotOf } from "@/lib/client/localCombos";
import type { RateResponse } from "@/lib/intelliscent/types";
import type { Fragrance } from "@/lib/schemas";

export default function ComboMatchPanel({
  base,
  username,
  engine,
  collection,
  collectionIds,
  goToTab,
}: IntelliScentActionProps) {
  const [layerIds, setLayerIds] = useState<number[]>([]); // scents added on top of the base
  const [rated, setRated] = useState<{ key: string; response: RateResponse } | null>(null);
  const [rating, setRating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxSize = engine.settings.maxComboSize;
  const selectedIds = useMemo(() => [base.id, ...layerIds], [base.id, layerIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const { get } = useFragrances(selectedIds);
  const combos = useCombos(username);

  // A rating belongs to a specific set of scents + settings; if either
  // changes afterwards, it's shown as outdated rather than silently wrong.
  const currentKey = `${comboKey(selectedIds)}|${JSON.stringify(engine)}`;
  const isStale = rated != null && rated.key !== currentKey;
  const canRate = layerIds.length > 0;
  const full = selectedIds.length >= maxSize;
  const saved = combos.some((c) => comboKey(c.fragranceIds) === comboKey(selectedIds));

  function addLayer(f: Fragrance) {
    const id = f.id;
    if (id == null || id === base.id || full) return;
    setLayerIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }

  async function handleRate() {
    const key = currentKey;
    setRating(true);
    setError(null);
    try {
      const response = await rateCombo({ ...engine, fragranceIds: selectedIds });
      fragranceCache.prime(response.fragrances);
      setRated({ key, response });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRating(false);
    }
  }

  function handleSave() {
    const fresh = rated && !isStale ? rated.response.result : null;
    addCombo(username, { fragranceIds: selectedIds, source: "match", snapshot: fresh ? snapshotOf(fresh) : null });
  }

  return (
    <div className="action-panel">
      <h3 className="panel-heading">Your combo</h3>
      <div className="combo-layers">
        {selectedIds.map((id, i) => {
          const f = get(id);
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
                  id === base.id ? (
                    <span className="muted">Picked</span>
                  ) : (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setLayerIds((ids) => ids.filter((x) => x !== id))}
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
      {!canRate && <p className="muted">Add at least one scent below to score the combo.</p>}

      <div className="button-row-inline">
        <button type="button" className="button button-primary" onClick={handleRate} disabled={!canRate || rating}>
          {rating ? "Scoring…" : "Score combo"}
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
        <div className={isStale ? "is-stale" : undefined}>
          {isStale && <p className="muted">Outdated - the scents or settings changed. Score again to update.</p>}
          <ComboResultView result={rated.response.result} getFragrance={get} collectionIds={collectionIds} detailsOpen />
        </div>
      )}

      <h3 className="panel-heading">Add a scent</h3>
      {full ? (
        <p className="muted">
          {maxSize === 3
            ? "Combos are capped at 3 scents - perfumers rarely stack more. Enable experimental 4-scent combos in Advanced settings to go further."
            : "That's the 4-scent maximum."}
        </p>
      ) : (
        <FragrancePicker collection={collection} excludeIds={selectedSet} onPick={addLayer} />
      )}
    </div>
  );
}
