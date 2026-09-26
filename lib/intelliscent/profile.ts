// The per-fragrance profile the layering framework scores on (see
// Docs/Fragrance Layering Algorithm, "The six-axis fragrance profile" and
// "The full data schema per fragrance"). Profiles are estimated from
// Fragrantica data (derive/deriveProfile.ts) and can be corrected by hand
// per user (ProfileOverride) - the framework's recommended source is how a
// scent actually wears, so a hand edit always wins over an estimate.

import { AXIS_IDS, type AccordVector, type AxisId } from "@/lib/intelliscent/axes";

export const MOLECULES = [
  { id: "ambroxan", label: "Ambroxan" },
  { id: "isoESuper", label: "Iso E Super" },
  { id: "ethylMaltol", label: "Ethyl maltol" },
  { id: "calone", label: "Calone" },
  { id: "cashmeran", label: "Cashmeran" },
  { id: "aldehydes", label: "Aldehydes" },
] as const;
export type MoleculeId = (typeof MOLECULES)[number]["id"];

export const SEASONS = ["spring", "summer", "fall", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const TIMES_OF_DAY = ["day", "night"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const OCCASIONS = [
  { id: "office", label: "Office" },
  { id: "casual", label: "Casual" },
  { id: "dateNight", label: "Date night" },
  { id: "formal", label: "Formal / event" },
  { id: "sport", label: "Sport / gym" },
] as const;
export type Occasion = (typeof OCCASIONS)[number]["id"];

/** Estimated intensity 0..1 at each checkpoint, per the framework. */
export interface TimeProfile {
  h0: number;
  h1: number;
  h4: number;
  h8: number;
}

export interface ContextTags {
  seasons: Record<Season, number>; // 0..1 suitability per season
  timeOfDay: Record<TimeOfDay, number>; // 0..1; high on both = versatile
  occasions: Record<Occasion, number>; // 0..1
  formality: number; // 0..1
}

/** Where a profile field's value came from - shown in the UI so estimates aren't mistaken for measurements. */
export type ProfileSource = "fragrantica-votes" | "fragrantica-accords" | "notes" | "estimated" | "checkins" | "manual";

export type ProfileField =
  | "accords"
  | "time"
  | "projection"
  | "longevity"
  | "sweetness"
  | "temperature"
  | "molecules"
  | "seasons"
  | "timeOfDay"
  | "occasions"
  | "formality";

export interface FragranceProfile {
  fragranceId: number;
  accords: AccordVector; // 0..1 per axis
  time: TimeProfile;
  projection: number; // 1..5
  longevity: number; // 1..5
  sweetness: number; // 0..1
  temperature: number; // -1 fresh .. +1 warm
  molecules: Record<MoleculeId, number>; // 0..1 flag intensity
  context: ContextTags;
  sources: Record<ProfileField, ProfileSource>;
  unmappedAccords: string[]; // Fragrantica accords with no axis - kept for transparency
}

/** A user's hand corrections. Any subset of fields; unspecified ones keep the estimate. */
export interface ProfileOverride {
  accords?: Partial<AccordVector>;
  time?: Partial<TimeProfile>;
  projection?: number;
  longevity?: number;
  sweetness?: number;
  temperature?: number;
  molecules?: Partial<Record<MoleculeId, number>>;
  seasons?: Partial<Record<Season, number>>;
  timeOfDay?: Partial<Record<TimeOfDay, number>>;
  occasions?: Partial<Record<Occasion, number>>;
  formality?: number;
}

/**
 * Share of total intensity in the 4h-8h window - the framework's measure of
 * base-heaviness. A non-increasing profile can't exceed 0.5 (at most half
 * of the four checkpoints fall in the late window).
 */
export function lateWeight(p: FragranceProfile): number {
  const { h0, h1, h4, h8 } = p.time;
  const total = h0 + h1 + h4 + h8;
  return total === 0 ? 0 : (h4 + h8) / total;
}

/** Single 1-5 strength rating used for mismatch checks and spray ratios: mean of projection and longevity. */
export function strength(p: FragranceProfile): number {
  return (p.projection + p.longevity) / 2;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function pickRecord<K extends string>(
  input: unknown,
  keys: readonly K[],
  lo: number,
  hi: number
): Partial<Record<K, number>> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const out: Partial<Record<K, number>> = {};
  for (const k of keys) {
    const v = num((input as Record<string, unknown>)[k]);
    if (v !== undefined) out[k] = clamp(v, lo, hi);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Coerces untrusted input (a request body, localStorage) into a valid override, dropping anything malformed. */
export function sanitizeOverride(input: unknown): ProfileOverride {
  if (!input || typeof input !== "object") return {};
  const o = input as Record<string, unknown>;
  const scalar = (k: string, lo: number, hi: number) => {
    const v = num(o[k]);
    return v === undefined ? undefined : clamp(v, lo, hi);
  };
  const result: ProfileOverride = {
    accords: pickRecord(o.accords, AXIS_IDS, 0, 1),
    time: pickRecord(o.time, ["h0", "h1", "h4", "h8"] as const, 0, 1),
    projection: scalar("projection", 1, 5),
    longevity: scalar("longevity", 1, 5),
    sweetness: scalar("sweetness", 0, 1),
    temperature: scalar("temperature", -1, 1),
    molecules: pickRecord(o.molecules, MOLECULES.map((m) => m.id), 0, 1),
    seasons: pickRecord(o.seasons, SEASONS, 0, 1),
    timeOfDay: pickRecord(o.timeOfDay, TIMES_OF_DAY, 0, 1),
    occasions: pickRecord(o.occasions, OCCASIONS.map((x) => x.id), 0, 1),
    formality: scalar("formality", 0, 1),
  };
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v !== undefined)) as ProfileOverride;
}

export function isEmptyOverride(o: ProfileOverride): boolean {
  return Object.keys(o).length === 0;
}

/** Applies a hand override on top of an estimated profile, marking touched fields as "manual". */
export function applyOverride(profile: FragranceProfile, override: ProfileOverride): FragranceProfile {
  const o = sanitizeOverride(override);
  const sources = { ...profile.sources };
  const mark = (field: ProfileField, touched: unknown) => {
    if (touched !== undefined) sources[field] = "manual";
  };
  mark("accords", o.accords);
  mark("time", o.time);
  mark("projection", o.projection);
  mark("longevity", o.longevity);
  mark("sweetness", o.sweetness);
  mark("temperature", o.temperature);
  mark("molecules", o.molecules);
  mark("seasons", o.seasons);
  mark("timeOfDay", o.timeOfDay);
  mark("occasions", o.occasions);
  mark("formality", o.formality);

  return {
    ...profile,
    accords: { ...profile.accords, ...o.accords },
    time: { ...profile.time, ...o.time },
    projection: o.projection ?? profile.projection,
    longevity: o.longevity ?? profile.longevity,
    sweetness: o.sweetness ?? profile.sweetness,
    temperature: o.temperature ?? profile.temperature,
    molecules: { ...profile.molecules, ...o.molecules },
    context: {
      seasons: { ...profile.context.seasons, ...o.seasons },
      timeOfDay: { ...profile.context.timeOfDay, ...o.timeOfDay },
      occasions: { ...profile.context.occasions, ...o.occasions },
      formality: o.formality ?? profile.context.formality,
    },
    sources,
  };
}

export type { AxisId };
