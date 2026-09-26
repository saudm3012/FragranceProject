"use client";

import { Fragment, useState } from "react";
import ComboResultView from "@/app/components/ComboResultView";
import FragranceChip from "@/app/components/FragranceChip";
import FeedbackForm from "@/app/layering/combos/FeedbackForm";
import { rateCombo } from "@/lib/client/api";
import * as fragranceCache from "@/lib/client/fragranceCache";
import { addClashes, removeClashes } from "@/lib/client/localIntelliScent";
import {
  addFeedback,
  deleteCombo,
  removeFeedback,
  setSnapshot,
  snapshotOf,
  updateNotes,
  type Combo,
  type ComboSource,
} from "@/lib/client/localCombos";
import { FEEDBACK_TAGS, type FeedbackEvent, type FeedbackTag } from "@/lib/intelliscent/personalization";
import type { EnginePayload } from "@/lib/intelliscent/types";
import type { Fragrance } from "@/lib/schemas";

// Typed as a full Record so adding a new ComboSource forces a label here.
const SOURCE_LABELS: Record<ComboSource, string> = {
  suggestion: "IntelliScent suggestion",
  match: "Combo match",
};

const TAG_LABELS = Object.fromEntries(FEEDBACK_TAGS.map((t) => [t.id, t.label])) as Record<FeedbackTag, string>;

export default function ComboCard({
  combo,
  username,
  engine,
  getFragrance,
  loading,
  collectionIds,
  isClash,
}: {
  combo: Combo;
  username: string;
  engine: EnginePayload;
  getFragrance: (id: number) => Fragrance | undefined;
  loading: boolean;
  collectionIds: ReadonlySet<number>;
  isClash: boolean;
}) {
  const [draft, setDraft] = useState(combo.notes);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = draft !== combo.notes;

  async function score() {
    setBusy(true);
    setError(null);
    try {
      const res = await rateCombo({ ...engine, fragranceIds: combo.fragranceIds });
      fragranceCache.prime(res.fragrances);
      setSnapshot(username, combo.id, snapshotOf(res.result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Each wear is logged with the combo's current score breakdown - which
  // accord pairings it leaned on is what personalization learns from.
  async function logWear(rating: FeedbackEvent["rating"], tags: FeedbackTag[]) {
    setBusy(true);
    setError(null);
    let snapshot: FeedbackEvent["snapshot"];
    try {
      const res = await rateCombo({ ...engine, fragranceIds: combo.fragranceIds });
      snapshot = { terms: res.result.terms, cells: res.result.cells, size: combo.fragranceIds.length };
    } catch {
      // Still log the wear; without cells it only informs the tag-driven adjustments.
      const terms = combo.snapshot?.terms ?? { harmony: 0.5, structure: 0.5, interest: 0.5, context: null };
      snapshot = { terms, cells: [], size: combo.fragranceIds.length };
    }
    addFeedback(username, combo.id, { id: crypto.randomUUID(), at: new Date().toISOString(), rating, tags, snapshot });
    setBusy(false);
  }

  return (
    <article className="card combo-card">
      <header className="combo-card-header">
        <span className="muted">
          {SOURCE_LABELS[combo.source]} · {new Date(combo.createdAt).toLocaleDateString()}
        </span>
      </header>

      {combo.snapshot ? (
        <ComboResultView result={combo.snapshot} getFragrance={getFragrance} collectionIds={collectionIds} />
      ) : (
        <>
          <div className="combo-layers">
            {combo.fragranceIds.map((id, i) => {
              const f = getFragrance(id);
              return (
                <Fragment key={id}>
                  {i > 0 && (
                    <span className="combo-plus" aria-hidden="true">
                      +
                    </span>
                  )}
                  <FragranceChip
                    name={f?.name ?? (loading ? "Loading…" : `Unknown fragrance #${id}`)}
                    brand={f?.brand}
                    imageUrl={f?.imageUrl}
                    inCollection={collectionIds.has(id)}
                  />
                </Fragment>
              );
            })}
          </div>
          <button type="button" className="button" onClick={score} disabled={busy}>
            {busy ? "Scoring…" : "Score with IntelliScent"}
          </button>
        </>
      )}

      {error && <p className="error">{error}</p>}

      <label className="combo-notes-label" htmlFor={`notes-${combo.id}`}>
        Journal
      </label>
      <textarea
        id={`notes-${combo.id}`}
        className="text-input combo-notes"
        rows={2}
        placeholder="Occasion, ratio, number of sprays, how it changed through the day…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {dirty && (
        <button type="button" className="button" onClick={() => updateNotes(username, combo.id, draft)}>
          Save notes
        </button>
      )}

      <details className="combo-details">
        <summary>
          Log a wear
          {combo.feedback.length > 0 && ` · worn ${combo.feedback.length}×`}
        </summary>
        <FeedbackForm onSubmit={logWear} busy={busy} />
        {combo.feedback.length > 0 && (
          <ul className="wear-log">
            {[...combo.feedback].reverse().map((e) => (
              <li key={e.id}>
                <span>
                  <strong>{e.rating}/5</strong> · {new Date(e.at).toLocaleDateString()}
                  {e.tags.length > 0 && ` · ${e.tags.map((t) => TAG_LABELS[t]).join(", ")}`}
                </span>
                <button type="button" className="link-button" onClick={() => removeFeedback(username, combo.id, e.id)}>
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>

      <div className="combo-card-actions">
        <label className="toggle-row small">
          <input
            type="checkbox"
            checked={isClash}
            onChange={(e) =>
              e.target.checked ? addClashes(username, combo.fragranceIds) : removeClashes(username, combo.fragranceIds)
            }
          />
          <span>Never suggest together</span>
        </label>
        {confirmingDelete ? (
          <>
            <button type="button" className="button" onClick={() => deleteCombo(username, combo.id)}>
              Confirm delete
            </button>
            <button type="button" className="link-button" onClick={() => setConfirmingDelete(false)}>
              cancel
            </button>
          </>
        ) : (
          <button type="button" className="link-button" onClick={() => setConfirmingDelete(true)}>
            Delete
          </button>
        )}
      </div>
    </article>
  );
}
