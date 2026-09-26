"use client";

import { useState } from "react";
import { createCustomFragrance } from "@/lib/client/api";
import { KNOWN_ACCORDS } from "@/lib/intelliscent/derive/accordMap";
import type { Fragrance } from "@/lib/schemas";

const splitList = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Create a fragrance that isn't on Fragrantica (or a personal blend). The
 * accords are what IntelliScent scores on, so they're picked from the
 * accords it understands; everything else is optional. The profile can be
 * fine-tuned afterwards in Layering -> IntelliScent -> Profile.
 */
export default function CustomFragranceForm({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string;
  onCreated: (fragrance: Fragrance) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState("");
  const [accords, setAccords] = useState<Array<{ name: string; strength: number }>>([]);
  const [nextAccord, setNextAccord] = useState("");
  const [notesTop, setNotesTop] = useState("");
  const [notesMiddle, setNotesMiddle] = useState("");
  const [notesBase, setNotesBase] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = KNOWN_ACCORDS.filter((a) => !accords.some((x) => x.name === a));

  function addAccord() {
    if (!nextAccord) return;
    // First accord defaults to 100 (Fragrantica's scale: the dominant accord is 100); later ones a bit lower.
    setAccords((a) => [...a, { name: nextAccord, strength: a.length === 0 ? 100 : 60 }]);
    setNextAccord("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createCustomFragrance({
        name: name.trim(),
        brand: brand.trim(),
        accords,
        notesTop: splitList(notesTop),
        notesMiddle: splitList(notesMiddle),
        notesBase: splitList(notesBase),
        description: description.trim() || undefined,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card custom-form" onSubmit={submit}>
      <h2>Create a custom fragrance</h2>
      <p className="muted small">For something Fragrantica doesn&apos;t have, or a blend of your own.</p>

      <label className="field">
        <span>Name *</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </label>
      <label className="field">
        <span>House / brand</span>
        <input
          className="text-input"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Leave empty for “Custom”"
          maxLength={120}
        />
      </label>

      <fieldset className="field">
        <legend>Main accords</legend>
        <p className="muted small">
          What IntelliScent layers on. Strength is relative - give the most dominant accord 100.
        </p>
        {accords.map((a, i) => (
          <div key={a.name} className="accord-edit-row">
            <span className="accord-edit-name">{a.name}</span>
            <input
              type="range"
              className="param-slider"
              min={1}
              max={100}
              value={a.strength}
              aria-label={`${a.name} strength`}
              onChange={(e) =>
                setAccords((list) => list.map((x, j) => (j === i ? { ...x, strength: Number(e.target.value) } : x)))
              }
            />
            <span className="param-value">{a.strength}</span>
            <button type="button" className="link-button" onClick={() => setAccords((list) => list.filter((_, j) => j !== i))}>
              remove
            </button>
          </div>
        ))}
        {accords.length < 15 && (
          <div className="accord-add-row">
            <select className="text-input" value={nextAccord} onChange={(e) => setNextAccord(e.target.value)} aria-label="Accord to add">
              <option value="">Choose an accord…</option>
              {available.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button type="button" className="button" onClick={addAccord} disabled={!nextAccord}>
              Add accord
            </button>
          </div>
        )}
      </fieldset>

      <label className="field">
        <span>Top notes</span>
        <input className="text-input" value={notesTop} onChange={(e) => setNotesTop(e.target.value)} placeholder="Comma-separated, e.g. bergamot, pink pepper" />
      </label>
      <label className="field">
        <span>Middle notes</span>
        <input className="text-input" value={notesMiddle} onChange={(e) => setNotesMiddle(e.target.value)} />
      </label>
      <label className="field">
        <span>Base notes</span>
        <input className="text-input" value={notesBase} onChange={(e) => setNotesBase(e.target.value)} />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea className="text-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </label>

      {accords.length === 0 && (
        <p className="muted small">Without accords IntelliScent can&apos;t score it for layering (you can still save it).</p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="button-row-inline">
        <button type="submit" className="button button-primary" disabled={saving || !name.trim()}>
          {saving ? "Creating…" : "Create fragrance"}
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          cancel
        </button>
      </div>
    </form>
  );
}
