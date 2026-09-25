"use client";

import { useEffect, useMemo, useState } from "react";
import FragranceChip from "@/app/components/FragranceChip";
import ScoreBadge from "@/app/components/ScoreBadge";
import type { IntelliScentActionProps } from "@/app/layering/intelliscent/types";
import { suggestLayers } from "@/lib/client/api";
import * as fragranceCache from "@/lib/client/fragranceCache";
import { useCombos } from "@/lib/client/hooks";
import { addCombo, comboKey } from "@/lib/client/localCombos";
import { INTELLISCENT_PARAMS } from "@/lib/intelliscent/params";
import type { ScoredCandidate, SuggestResponse } from "@/lib/intelliscent/types";

type Scope = "collection" | "all";

const SCOPES: ReadonlyArray<{ id: Scope; label: string; emptyMessage: string }> = [
  {
    id: "collection",
    label: "From my collection",
    emptyMessage: "Nothing else in your collection to rank yet - try all cached fragrances, or add more to your collection.",
  },
  {
    id: "all",
    label: "All cached fragrances",
    emptyMessage: "No other cached fragrances to rank yet. The pool grows as fragrances get looked up.",
  },
];

const LIMIT = 15;

export default function SuggestionsPanel({ base, params, username, collectionIds, goToTab }: IntelliScentActionProps) {
  const [scope, setScope] = useState<Scope>("collection");
  const [runParams, setRunParams] = useState(params); // the settings the shown results were computed with
  const [runId, setRunId] = useState(0); // bumped to force a re-run with unchanged inputs
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const combos = useCombos(username);
  const savedKeys = useMemo(() => new Set(combos.map((c) => comboKey(c.fragranceIds))), [combos]);

  // A string, so the effect below re-runs only when the pool actually changes.
  const poolKey = scope === "collection" ? [...collectionIds].sort((a, b) => a - b).join(",") : null;

  useEffect(() => {
    let cancelled = false;
    const poolIds = poolKey === null ? undefined : poolKey === "" ? [] : poolKey.split(",").map(Number);
    suggestLayers({ fragranceId: base.id, params: runParams, poolIds, limit: LIMIT })
      .then((res) => {
        if (cancelled) return;
        fragranceCache.prime(res.suggestions.map((s) => s.fragrance));
        setResult(res);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base.id, runParams, poolKey, runId]);

  const settingsChanged = INTELLISCENT_PARAMS.some((p) => params[p.id] !== runParams[p.id]);
  const activeScope = SCOPES.find((s) => s.id === scope)!;

  function rerun() {
    setLoading(true);
    setRunParams(params);
    setRunId((n) => n + 1);
  }

  function changeScope(next: Scope) {
    if (next === scope) return;
    setLoading(true);
    setScope(next);
  }

  function save(suggestion: ScoredCandidate) {
    addCombo(username, {
      fragranceIds: [base.id, suggestion.fragranceId],
      source: "suggestion",
      score: suggestion.score,
      params: result?.params ?? runParams,
    });
  }

  return (
    <div className="action-panel">
      <div className="action-panel-toolbar">
        <div className="segmented" role="group" aria-label="Suggest from">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === scope ? "segmented-option is-active" : "segmented-option"}
              aria-pressed={s.id === scope}
              onClick={() => changeScope(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" className="button" onClick={rerun} disabled={loading}>
          {settingsChanged ? "Re-run with new settings" : "Re-run"}
        </button>
      </div>

      {settingsChanged && !loading && (
        <p className="muted">Settings changed since these results were computed.</p>
      )}
      {loading && <p className="spinner-text">Running IntelliScent…</p>}
      {error && <p className="error">{error}</p>}

      {result && (
        <div className={loading ? "is-stale" : undefined}>
          <p className="muted algo-meta">
            {result.algorithm.name} v{result.algorithm.version} · ranked {result.poolSize} fragrance
            {result.poolSize === 1 ? "" : "s"}
            {result.algorithm.isPlaceholder && " · placeholder scoring until the real algorithm lands"}
          </p>

          {result.suggestions.length === 0 && <p className="muted">{activeScope.emptyMessage}</p>}

          <div className="chip-list">
            {result.suggestions.map((s) => {
              const saved = savedKeys.has(comboKey([base.id, s.fragranceId]));
              return (
                <div key={s.fragranceId} className="suggestion-row">
                  <FragranceChip
                    name={s.fragrance.name}
                    brand={s.fragrance.brand}
                    imageUrl={s.fragrance.imageUrl}
                    inCollection={collectionIds.has(s.fragranceId)}
                    trailing={
                      <>
                        <ScoreBadge score={s.score} />
                        <button type="button" className="button" disabled={saved} onClick={() => save(s)}>
                          {saved ? "Saved" : "Save combo"}
                        </button>
                      </>
                    }
                  />
                  <p className="muted suggestion-reason">{s.reason}</p>
                </div>
              );
            })}
          </div>

          {result.suggestions.some((s) => savedKeys.has(comboKey([base.id, s.fragranceId]))) && (
            <button type="button" className="link-button" onClick={() => goToTab("combos")}>
              View in My Combos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
