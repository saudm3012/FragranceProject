"use client";

import { useEffect, useState } from "react";
import type { IntelliScentActionProps } from "@/app/layering/intelliscent/types";
import { fetchProfiles } from "@/lib/client/api";
import { applyCheckins } from "@/lib/intelliscent/checkins";
import { setOverride } from "@/lib/client/localIntelliScent";
import { AXES } from "@/lib/intelliscent/axes";
import {
  lateWeight,
  MOLECULES,
  OCCASIONS,
  SEASONS,
  strength,
  TIMES_OF_DAY,
  type FragranceProfile,
  type ProfileField,
  type ProfileOverride,
  type ProfileSource,
} from "@/lib/intelliscent/profile";

// One editable number in a profile: how to read it, and how to write it into an override.
interface Field {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  get: (p: FragranceProfile) => number;
  put: (o: ProfileOverride, v: number) => void;
}

interface Section {
  id: string;
  title: string;
  source: ProfileField; // which source badge to show
  hint?: string;
  fields: Field[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The profile editor's layout. Add a field here and it's editable, saved and scored.
const SECTIONS: readonly Section[] = [
  {
    id: "time",
    title: "Time profile",
    source: "time",
    hint: "Intensity at each checkpoint. The framework calls this the single most important field.",
    fields: (["h0", "h1", "h4", "h8"] as const).map((k) => ({
      key: `time.${k}`,
      label: { h0: "Opening", h1: "1 hour", h4: "4 hours", h8: "8 hours" }[k],
      min: 0,
      max: 1,
      step: 0.05,
      get: (p) => p.time[k],
      put: (o, v) => (o.time = { ...o.time, [k]: v }),
    })),
  },
  {
    id: "strength",
    title: "Strength",
    source: "longevity",
    fields: [
      { key: "projection", label: "Projection (1-5)", min: 1, max: 5, step: 0.25, get: (p) => p.projection, put: (o, v) => (o.projection = v) },
      { key: "longevity", label: "Longevity (1-5)", min: 1, max: 5, step: 0.25, get: (p) => p.longevity, put: (o, v) => (o.longevity = v) },
    ],
  },
  {
    id: "character",
    title: "Character",
    source: "sweetness",
    fields: [
      { key: "sweetness", label: "Sweetness", min: 0, max: 1, step: 0.05, get: (p) => p.sweetness, put: (o, v) => (o.sweetness = v) },
      { key: "temperature", label: "Temperature (fresh → warm)", min: -1, max: 1, step: 0.05, get: (p) => p.temperature, put: (o, v) => (o.temperature = v) },
    ],
  },
  {
    id: "accords",
    title: "Accords",
    source: "accords",
    hint: "How strongly each family is actually present, 0-1.",
    fields: AXES.map((a) => ({
      key: `accords.${a.id}`,
      label: a.label,
      min: 0,
      max: 1,
      step: 0.05,
      get: (p) => p.accords[a.id],
      put: (o, v) => (o.accords = { ...o.accords, [a.id]: v }),
    })),
  },
  {
    id: "molecules",
    title: "Loud molecules",
    source: "molecules",
    hint: "0 = absent, 1 = clearly present. Brands often leave these off note lists, so detection under-reports.",
    fields: MOLECULES.map((m) => ({
      key: `molecules.${m.id}`,
      label: m.label,
      min: 0,
      max: 1,
      step: 0.1,
      get: (p) => p.molecules[m.id],
      put: (o, v) => (o.molecules = { ...o.molecules, [m.id]: v }),
    })),
  },
  {
    id: "seasons",
    title: "Seasons",
    source: "seasons",
    fields: SEASONS.map((s) => ({
      key: `seasons.${s}`,
      label: cap(s),
      min: 0,
      max: 1,
      step: 0.05,
      get: (p) => p.context.seasons[s],
      put: (o, v) => (o.seasons = { ...o.seasons, [s]: v }),
    })),
  },
  {
    id: "timeOfDay",
    title: "Time of day",
    source: "timeOfDay",
    fields: TIMES_OF_DAY.map((t) => ({
      key: `timeOfDay.${t}`,
      label: cap(t),
      min: 0,
      max: 1,
      step: 0.05,
      get: (p) => p.context.timeOfDay[t],
      put: (o, v) => (o.timeOfDay = { ...o.timeOfDay, [t]: v }),
    })),
  },
  {
    id: "occasions",
    title: "Occasions",
    source: "occasions",
    fields: [
      ...OCCASIONS.map(
        (occ): Field => ({
          key: `occasions.${occ.id}`,
          label: occ.label,
          min: 0,
          max: 1,
          step: 0.05,
          get: (p) => p.context.occasions[occ.id],
          put: (o, v) => (o.occasions = { ...o.occasions, [occ.id]: v }),
        })
      ),
      { key: "formality", label: "Formality", min: 0, max: 1, step: 0.05, get: (p) => p.context.formality, put: (o, v) => (o.formality = v) },
    ],
  },
];

const SOURCE_LABELS: Record<ProfileSource, string> = {
  "fragrantica-votes": "Fragrantica votes",
  "fragrantica-accords": "Fragrantica accords",
  notes: "From the note list",
  estimated: "Estimated",
  checkins: "From your wears",
  manual: "Your edit",
};

const round = (v: number) => Math.round(v * 1000) / 1000;

export default function ProfilePanel({ base, username, engine }: IntelliScentActionProps) {
  const [estimated, setEstimated] = useState<FragranceProfile | null>(null);
  const [effective, setEffective] = useState<FragranceProfile | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({}); // field key -> value, only fields touched this session
  const [error, setError] = useState<string | null>(null);

  const override = engine.overrides?.[String(base.id)];
  const checkins = engine.checkins?.[String(base.id)];
  const overrideKey = JSON.stringify(override ?? {});
  const checkinsKey = JSON.stringify(checkins ?? null);

  useEffect(() => {
    let cancelled = false;
    const overrides = overrideKey === "{}" ? undefined : { [String(base.id)]: JSON.parse(overrideKey) };
    const checkinsMap = checkinsKey === "null" ? undefined : { [String(base.id)]: JSON.parse(checkinsKey) };
    fetchProfiles({ ids: [base.id], overrides, checkins: checkinsMap })
      .then((res) => {
        if (cancelled) return;
        setEstimated(res.profiles[0]?.estimated ?? null);
        setEffective(res.profiles[0]?.effective ?? null);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [base.id, overrideKey, checkinsKey]);

  if (error) return <p className="error">{error}</p>;
  if (!estimated || !effective) return <p className="spinner-text">Loading profile…</p>;

  const valueOf = (f: Field) => draft[f.key] ?? f.get(effective);
  // What the profile would be without hand edits (estimate + wear check-ins) - edits are measured against this.
  const baseline = applyCheckins(estimated, checkins);
  const dirty = Object.keys(draft).length > 0;

  function save() {
    // Keep fields edited now or in an earlier session. A field dragged back
    // to (within half a step of) the estimate counts as un-edited again.
    const next: ProfileOverride = {};
    for (const section of SECTIONS) {
      for (const f of section.fields) {
        const est = f.get(baseline);
        const touched = f.key in draft;
        const previouslyEdited = f.get(effective!) !== est;
        if (!touched && !previouslyEdited) continue;
        const v = touched ? draft[f.key] : f.get(effective!);
        if (Math.abs(v - est) < f.step / 2) continue;
        f.put(next, round(v));
      }
    }
    setOverride(username, base.id, next);
    setDraft({});
  }

  function resetAll() {
    setOverride(username, base.id, {});
    setDraft({});
  }

  return (
    <div className="action-panel profile-panel">
      <p className="muted">
        How IntelliScent reads <strong>{base.name}</strong>. Estimates come from Fragrantica - correct anything that
        doesn&apos;t match how it actually wears on you, and every score uses your version. Quick check-ins
        in My Combos (&quot;still noticeable at 4 hours?&quot;) update it too.
      </p>
      <p className="muted small">
        Late weight {lateWeight(effective).toFixed(2)} · strength {strength(effective).toFixed(1)} / 5
        {effective.unmappedAccords.length > 0 && ` · unmapped accords: ${effective.unmappedAccords.join(", ")}`}
      </p>

      {SECTIONS.map((section) => (
        <details key={section.id} className="settings-group" open={section.id === "time" || section.id === "strength"}>
          <summary>
            {section.title}{" "}
            <span className={`source-tag source-${effective.sources[section.source]}`}>
              {SOURCE_LABELS[effective.sources[section.source]]}
            </span>
          </summary>
          {section.hint && <p className="muted param-description">{section.hint}</p>}
          {section.fields.map((f) => (
            <div key={f.key} className="param-row compact">
              <div className="param-row-head">
                <label htmlFor={`profile-${f.key}`}>{f.label}</label>
                <span className="param-value">{valueOf(f).toFixed(2)}</span>
              </div>
              <input
                id={`profile-${f.key}`}
                className="param-slider"
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={valueOf(f)}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </details>
      ))}

      <div className="button-row-inline">
        <button type="button" className="button button-primary" onClick={save} disabled={!dirty}>
          Save my corrections
        </button>
        {dirty && (
          <button type="button" className="link-button" onClick={() => setDraft({})}>
            discard changes
          </button>
        )}
        {override && (
          <button type="button" className="link-button" onClick={resetAll}>
            Reset to estimate
          </button>
        )}
      </div>
    </div>
  );
}
