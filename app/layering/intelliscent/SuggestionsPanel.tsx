"use client";

import { useEffect, useMemo, useState } from "react";
import ComboResultView from "@/app/components/ComboResultView";
import { bandOf, SCORE_BANDS } from "@/app/components/ScoreBadge";
import type { IntelliScentActionProps } from "@/app/layering/intelliscent/types";
import { suggestLayers } from "@/lib/client/api";
import * as fragranceCache from "@/lib/client/fragranceCache";
import { useCombos, useFragrances } from "@/lib/client/hooks";
import { addCombo, comboKey, snapshotOf } from "@/lib/client/localCombos";
import type { ComboResult, SuggestResponse } from "@/lib/intelliscent/types";

type Scope = "collection" | "all";

const SCOPES: ReadonlyArray<{ id: Scope; label: string; emptyMessage: string }> = [
  {
    id: "collection",
    label: "From my collection",
    emptyMessage: "Nothing in your collection clears the minimum score. Try all cached fragrances, lower the minimum score, or add more to your collection.",
  },
  {
    id: "all",
    label: "All cached fragrances",
    emptyMessage: "No cached fragrance clears the minimum score yet. The pool grows as fragrances get looked up.",
  },
];

const LIMIT = 20;

/**
 * Ranked combos from IntelliScent. With a base scent: partners for it
 * (pairs, then greedily-extended triples). Without one: the best combos
 * anywhere in the pool - the framework's "run it over every pair in the
 * collection" mode.
 */
export default function SuggestionsPanel({
  base,
  username,
  engine,
  collectionIds,
  goToTab,
  fixedScope,
}: Omit<IntelliScentActionProps, "base" | "collection"> & {
  base: IntelliScentActionProps["base"] | null;
  collection?: IntelliScentActionProps["collection"];
  fixedScope?: Scope;
}) {
  const [scope, setScope] = useState<Scope>(fixedScope ?? "collection");
  const [runEngine, setRunEngine] = useState(engine); // the settings the shown results were computed with
  const [runId, setRunId] = useState(0); // bumped to force a re-run with unchanged inputs
  const [response, setResponse] = useState<SuggestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const combos = useCombos(username);
  const savedKeys = useMemo(() => new Set(combos.map((c) => comboKey(c.fragranceIds))), [combos]);
  const { get } = useFragrances(response?.results.flatMap((r) => r.fragranceIds) ?? []);

  // A string, so the effect re-runs only when the pool actually changes.
  const poolKey = scope === "collection" ? [...collectionIds].sort((a, b) => a - b).join(",") : null;
  const baseId = base?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    const poolIds = poolKey === null ? undefined : poolKey === "" ? [] : poolKey.split(",").map(Number);
    suggestLayers({ ...runEngine, baseId, poolIds, limit: LIMIT })
      .then((res) => {
        if (cancelled) return;
        fragranceCache.prime(res.fragrances);
        setResponse(res);
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
  }, [baseId, runEngine, poolKey, runId]);

  const settingsChanged = JSON.stringify(engine) !== JSON.stringify(runEngine);
  const activeScope = SCOPES.find((s) => s.id === scope)!;

  function rerun() {
    setLoading(true);
    setRunEngine(engine);
    setRunId((n) => n + 1);
  }

  function changeScope(next: Scope) {
    if (next === scope) return;
    setLoading(true);
    setScope(next);
  }

  function save(result: ComboResult) {
    addCombo(username, { fragranceIds: result.fragranceIds, source: "suggestion", snapshot: snapshotOf(result) });
  }

  const triples = response?.results.filter((r) => r.fragranceIds.length > 2).length ?? 0;

  return (
    <div className="action-panel">
      <div className="action-panel-toolbar">
        {fixedScope ? (
          <span />
        ) : (
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
        )}
        <button type="button" className="button" onClick={rerun} disabled={loading}>
          {settingsChanged ? "Re-run with new settings" : "Re-run"}
        </button>
      </div>

      {settingsChanged && !loading && <p className="muted">Settings changed since these results were computed.</p>}
      {loading && <p className="spinner-text">Running IntelliScent…</p>}
      {error && <p className="error">{error}</p>}

      {response && (
        <div className={loading ? "is-stale" : undefined}>
          <p className="muted algo-meta">
            Scored {response.poolSize} fragrance{response.poolSize === 1 ? "" : "s"} ·{" "}
            {response.results.length} result{response.results.length === 1 ? "" : "s"}
            {triples > 0 && ` (${triples} with a third scent)`}
          </p>

          {response.insights.map((text) => (
            <p key={text} className="insight">
              {text}
            </p>
          ))}

          {response.results.length === 0 && <p className="muted">{activeScope.emptyMessage}</p>}

          {SCORE_BANDS.map((band) => {
            const inBand = response.results.filter((r) => bandOf(r.score).id === band.id);
            if (inBand.length === 0) return null;
            const cards = inBand.map((r) => {
              const saved = savedKeys.has(comboKey(r.fragranceIds));
              return (
                <div key={comboKey(r.fragranceIds)} className="card">
                  <ComboResultView
                    result={r}
                    getFragrance={get}
                    collectionIds={collectionIds}
                    actions={
                      <>
                        <button type="button" className="button" disabled={saved} onClick={() => save(r)}>
                          {saved ? "Saved" : "Save combo"}
                        </button>
                        {saved && (
                          <button type="button" className="link-button" onClick={() => goToTab("combos")}>
                            View
                          </button>
                        )}
                      </>
                    }
                  />
                </div>
              );
            });
            const heading = `${band.label} (${inBand.length})`;
            return band.collapsed ? (
              <details key={band.id} className="band-group">
                <summary>{heading}</summary>
                {cards}
              </details>
            ) : (
              <section key={band.id}>
                <h4 className="band-heading">{heading}</h4>
                {cards}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
