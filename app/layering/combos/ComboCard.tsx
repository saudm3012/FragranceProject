"use client";

import { Fragment, useState } from "react";
import FragranceChip from "@/app/components/FragranceChip";
import ScoreBadge from "@/app/components/ScoreBadge";
import type { Combo, ComboSource } from "@/lib/client/localCombos";
import { describeParams } from "@/lib/intelliscent/params";
import type { Fragrance } from "@/lib/schemas";

// Typed as a full Record so adding a new ComboSource forces a label here.
const SOURCE_LABELS: Record<ComboSource, string> = {
  suggestion: "IntelliScent suggestion",
  match: "Combo match",
};

export default function ComboCard({
  combo,
  getFragrance,
  loading,
  collectionIds,
  onSaveNotes,
  onDelete,
}: {
  combo: Combo;
  getFragrance: (id: number) => Fragrance | undefined;
  loading: boolean;
  collectionIds: ReadonlySet<number>;
  onSaveNotes: (notes: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(combo.notes);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const dirty = draft !== combo.notes;

  return (
    <article className="card combo-card">
      <header className="combo-card-header">
        <span className="muted">
          {SOURCE_LABELS[combo.source]} · {new Date(combo.createdAt).toLocaleDateString()}
        </span>
        {combo.score != null && <ScoreBadge score={combo.score} label={combo.scoreLabel} />}
      </header>

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

      {combo.params && <p className="muted combo-params">Tuned with {describeParams(combo.params)}</p>}

      <label className="combo-notes-label" htmlFor={`notes-${combo.id}`}>
        Journal
      </label>
      <textarea
        id={`notes-${combo.id}`}
        className="text-input combo-notes"
        rows={3}
        placeholder="How did it wear? Occasion, ratio, number of sprays…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />

      <div className="combo-card-actions">
        {dirty && (
          <button type="button" className="button" onClick={() => onSaveNotes(draft)}>
            Save notes
          </button>
        )}
        {confirmingDelete ? (
          <>
            <button type="button" className="button" onClick={onDelete}>
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
