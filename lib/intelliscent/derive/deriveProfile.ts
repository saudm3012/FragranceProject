// Estimates a framework profile (profile.ts) from what Fragrantica gives us.
//
// Source priority, per field:
//   - Community votes (longevity, sillage, season, day/night) when the page
//     had enough of them - this is the "community consensus on true
//     character" the framework asks for.
//   - Otherwise estimates from the accord vector using the per-axis
//     properties in axes.ts. These are heuristics, marked "estimated".
// The framework explicitly warns that marketing-derived data gives
// confidently wrong answers; hand overrides (profile.ts) exist to fix that
// for the bottles a user actually owns.

import { AXES, AXIS_IDS, emptyVector, type AccordVector, type AxisId } from "@/lib/intelliscent/axes";
import {
  ACCORD_SWEETNESS,
  ACCORD_TO_AXES,
  CREAMY_WOOD_NOTES,
  DEFAULT_CREAMY_SHARE,
  DRY_WOOD_NOTES,
  LONGEVITY_LEVELS,
  MOLECULE_SIGNALS,
  SILLAGE_LEVELS,
} from "@/lib/intelliscent/derive/accordMap";
import {
  MOLECULES,
  OCCASIONS,
  SEASONS,
  TIMES_OF_DAY,
  type ContextTags,
  type FragranceProfile,
  type MoleculeId,
  type Occasion,
  type ProfileField,
  type ProfileSource,
  type TimeProfile,
} from "@/lib/intelliscent/profile";
import type { Fragrance, VoteCounts } from "@/lib/schemas";

const MIN_VOTES = 10; // fewer than this and a vote average is too noisy to trust over the estimate

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function weightedAxisAverage(v: AccordVector, prop: (id: AxisId) => number): number {
  let weighted = 0;
  let total = 0;
  for (const id of AXIS_IDS) {
    weighted += v[id] * prop(id);
    total += v[id];
  }
  return total === 0 ? 0 : weighted / total;
}

const AXIS_PROPS = new Map<AxisId, (typeof AXES)[number]>(AXES.map((a) => [a.id, a]));
const prop = (key: "halfLifeHours" | "warmth" | "sweetness" | "loudness") => (id: AxisId) =>
  AXIS_PROPS.get(id)![key];

function voteAverage(votes: VoteCounts | null | undefined, levels: Record<string, number>): number | null {
  if (!votes) return null;
  let sum = 0;
  let count = 0;
  for (const [option, n] of Object.entries(votes)) {
    const level = levels[option];
    if (level === undefined) continue;
    sum += level * n;
    count += n;
  }
  return count >= MIN_VOTES ? sum / count : null;
}

/** Vote counts scaled so the most-voted option is 1. */
function voteShares<K extends string>(votes: VoteCounts | null | undefined, keys: readonly K[]): Record<K, number> | null {
  if (!votes) return null;
  const total = keys.reduce((s, k) => s + (votes[k] ?? 0), 0);
  if (total < MIN_VOTES) return null;
  const max = Math.max(...keys.map((k) => votes[k] ?? 0));
  return Object.fromEntries(keys.map((k) => [k, max === 0 ? 0 : (votes[k] ?? 0) / max])) as Record<K, number>;
}

/**
 * Combines independent 0-1 signals: 1 - (1-a)(1-b)... Several Fragrantica
 * accords often feed one axis (cacao + sweet + vanilla -> gourmand); a
 * plain sum clips at 1 and flattens every rich profile into ties, while
 * this keeps growing with extra evidence without ever exceeding 1.
 */
function orCombine(current: number, signal: number): number {
  return 1 - (1 - current) * (1 - clamp(signal));
}

function buildAccordVector(f: Fragrance): { vector: AccordVector; unmapped: string[] } {
  const notes = [...f.notesTop, ...f.notesMiddle, ...f.notesBase].map((n) => n.toLowerCase());
  const creamyHits = notes.filter((n) => CREAMY_WOOD_NOTES.some((k) => n.includes(k))).length;
  const dryHits = notes.filter((n) => DRY_WOOD_NOTES.some((k) => n.includes(k))).length;
  const creamyShare = creamyHits + dryHits === 0 ? DEFAULT_CREAMY_SHARE : creamyHits / (creamyHits + dryHits);

  const vector = emptyVector();
  const unmapped: string[] = [];
  for (const accord of f.accords) {
    const name = accord.name.toLowerCase().trim();
    const presence = accord.strength / 100;
    if (name === "woody") {
      vector.dryWoods = orCombine(vector.dryWoods, presence * (1 - creamyShare));
      vector.creamyWoods = orCombine(vector.creamyWoods, presence * creamyShare);
      continue;
    }
    const weights = ACCORD_TO_AXES[name];
    if (!weights) {
      unmapped.push(accord.name);
      continue;
    }
    for (const [axisId, w] of Object.entries(weights) as Array<[AxisId, number]>) {
      vector[axisId] = orCombine(vector[axisId], presence * w);
    }
  }
  return { vector, unmapped };
}

/** Intensity over time as the sum of each axis decaying at its own half-life, stretched by longevity. */
function estimateTimeProfile(v: AccordVector, longevity: number): TimeProfile {
  const stretch = 0.5 + 0.25 * (longevity - 1); // longevity 1 -> half as long, 3 -> as-is, 5 -> 1.5x
  const intensityAt = (t: number) =>
    AXIS_IDS.reduce((sum, id) => sum + v[id] * Math.pow(2, -t / (prop("halfLifeHours")(id) * stretch)), 0);
  const i0 = intensityAt(0);
  if (i0 === 0) return { h0: 0, h1: 0, h4: 0, h8: 0 };
  const round = (x: number) => Math.round((x / i0) * 1000) / 1000;
  return { h0: 1, h1: round(intensityAt(1)), h4: round(intensityAt(4)), h8: round(intensityAt(8)) };
}

/**
 * Sweetness from the accords that directly signal it (sweet, vanilla,
 * caramel...), OR-combined like the axes - so one dominant vanilla accord
 * reads as sweet instead of being averaged away by unrelated accords.
 */
function estimateSweetness(f: Fragrance, v: AccordVector): number {
  let direct = 0;
  for (const a of f.accords) {
    direct = orCombine(direct, (a.strength / 100) * (ACCORD_SWEETNESS[a.name.toLowerCase().trim()] ?? 0));
  }
  return clamp(Math.max(direct, weightedAxisAverage(v, prop("sweetness"))));
}

function detectMolecules(f: Fragrance): Record<MoleculeId, number> {
  const notes = [...f.notesTop, ...f.notesMiddle, ...f.notesBase].map((n) => n.toLowerCase());
  const accords = new Map(f.accords.map((a) => [a.name.toLowerCase().trim(), a.strength]));
  return Object.fromEntries(
    MOLECULES.map(({ id }) => {
      const signals = MOLECULE_SIGNALS[id];
      let value = 0;
      for (const [fragment, confidence] of signals.notes) {
        if (notes.some((n) => n.includes(fragment))) value = Math.max(value, confidence);
      }
      for (const s of signals.accords ?? []) {
        if ((accords.get(s.name) ?? 0) >= s.minStrength) value = Math.max(value, s.value);
      }
      return [id, value];
    })
  ) as Record<MoleculeId, number>;
}

function shareOf(v: AccordVector, ids: AxisId[]): number {
  const total = AXIS_IDS.reduce((s, id) => s + v[id], 0);
  return total === 0 ? 0 : ids.reduce((s, id) => s + v[id], 0) / total;
}

function estimateContext(
  f: Fragrance,
  v: AccordVector,
  temperature: number,
  sweetness: number,
  projection: number
): { context: ContextTags; seasonsFromVotes: boolean; timeFromVotes: boolean } {
  const seasonVotes = voteShares(f.votes?.seasons, SEASONS);
  const seasons = seasonVotes ?? {
    winter: clamp(0.5 + 0.5 * temperature),
    fall: clamp(0.6 + 0.3 * temperature),
    spring: clamp(0.6 - 0.3 * temperature),
    summer: clamp(0.5 - 0.5 * temperature),
  };

  const projN = (projection - 1) / 4;
  const timeVotes = voteShares(f.votes?.timeOfDay, TIMES_OF_DAY);
  const timeOfDay = timeVotes ?? {
    day: clamp(0.6 - 0.3 * temperature),
    night: clamp(0.6 + 0.3 * temperature + 0.1 * (projN - 0.5)),
  };

  const formality = clamp(
    0.5 +
      0.6 *
        (shareOf(v, ["powderyIris", "rose", "whiteFloral", "amberResin", "leatherAnimalic", "smokeOud", "creamyWoods"]) -
          shareOf(v, ["fruity", "aquatic", "citrus", "gourmand", "freshSpice"]))
  );
  const freshness = (1 - temperature) / 2;
  const occasions: Record<Occasion, number> = {
    office: clamp(0.45 * (1 - projN) + 0.3 * (1 - sweetness) + 0.25 * freshness),
    casual: clamp(0.4 + 0.4 * (1 - formality) + 0.2 * (1 - projN)),
    dateNight: clamp(0.35 * sweetness + 0.35 * ((temperature + 1) / 2) + 0.3 * timeOfDay.night),
    formal: clamp(0.6 * formality + 0.4 * projN),
    sport: clamp(
      0.5 * shareOf(v, ["citrus", "aquatic", "green", "freshSpice", "aromatic"]) + 0.3 * (1 - sweetness) + 0.2 * (1 - projN)
    ),
  };
  // Keep the key order stable for display.
  const orderedOccasions = Object.fromEntries(OCCASIONS.map((o) => [o.id, occasions[o.id]])) as Record<Occasion, number>;

  return {
    context: { seasons, timeOfDay, occasions: orderedOccasions, formality },
    seasonsFromVotes: seasonVotes !== null,
    timeFromVotes: timeVotes !== null,
  };
}

export function deriveProfile(f: Fragrance & { id: number }): FragranceProfile {
  const { vector, unmapped } = buildAccordVector(f);

  const longevityVotes = voteAverage(f.votes?.longevity, LONGEVITY_LEVELS);
  const persistence = weightedAxisAverage(vector, prop("halfLifeHours")); // weighted half-life, hours
  const longevity = longevityVotes ?? clamp(1 + (4 * (persistence - 1)) / 9, 1, 5);

  const sillageVotes = voteAverage(f.votes?.sillage, SILLAGE_LEVELS);
  const projection = sillageVotes ?? clamp(1 + 4 * weightedAxisAverage(vector, prop("loudness")), 1, 5);

  const temperature = clamp(weightedAxisAverage(vector, prop("warmth")), -1, 1);
  const sweetness = estimateSweetness(f, vector);
  const { context, seasonsFromVotes, timeFromVotes } = estimateContext(f, vector, temperature, sweetness, projection);

  const sources: Record<ProfileField, ProfileSource> = {
    accords: "fragrantica-accords",
    time: "estimated",
    projection: sillageVotes !== null ? "fragrantica-votes" : "estimated",
    longevity: longevityVotes !== null ? "fragrantica-votes" : "estimated",
    sweetness: "estimated",
    temperature: "estimated",
    molecules: "notes",
    seasons: seasonsFromVotes ? "fragrantica-votes" : "estimated",
    timeOfDay: timeFromVotes ? "fragrantica-votes" : "estimated",
    occasions: "estimated",
    formality: "estimated",
  };

  const round2 = (x: number) => Math.round(x * 100) / 100;
  return {
    fragranceId: f.id,
    accords: Object.fromEntries(AXIS_IDS.map((id) => [id, round2(vector[id])])) as AccordVector,
    time: estimateTimeProfile(vector, longevity),
    projection: round2(projection),
    longevity: round2(longevity),
    sweetness: round2(sweetness),
    temperature: round2(temperature),
    molecules: detectMolecules(f),
    context,
    sources,
    unmappedAccords: unmapped,
  };
}
