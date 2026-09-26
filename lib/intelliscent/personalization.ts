// Layer 1 of "How feedback improves future suggestions": the user's
// personal preference layer. Built by replaying the user's combo journal -
// a pure function, so it can be recomputed any time and never drifts from
// the journal it came from.
//
// The unit of evidence is a distinct COMBO, not a wear. Three wears of one
// combo are one experience repeated, not three independent data points, so
// they only raise confidence in that combo's contribution; the "at least
// MIN_SAMPLES" safeguards count distinct combos.
//
//   - Each combo nudges the affinity cells it leaned on toward its average
//     rating (exponential moving average), weighted by how much each cell
//     contributed and by how many times it's been worn.
//   - Cells rated consistently low become personal hard-avoids.
//   - Reason tags nudge the knob the framework (and its author's review)
//     ties them to: "too sweet" -> sweetness cap down, loving combos that
//     tripped the sweetness cap -> cap up, "overpowering" -> strength
//     tolerance down, "faded fast" -> spray multiplier up (a dosing
//     complaint, not a timing one), "smelled muddled" -> Structure weight up,
//     "wrong for the occasion" -> Context weight up, "loved it" on a bold,
//     high-Interest combo -> Interest weight up.
//
// Layer 2 (shared corrections to fragrance profiles from many users) needs
// trustworthy identity to aggregate across users, so it waits for real
// accounts.

import { DEFAULT_AFFINITY } from "@/lib/intelliscent/affinity";
import type { CellShare, ComboTerms, PenaltyRule } from "@/lib/intelliscent/engine/types";
import type { PersonalLayer } from "@/lib/intelliscent/engine";
import type { IntelliScentSettings } from "@/lib/intelliscent/settings";

export const FEEDBACK_TAGS = [
  { id: "loved-it", label: "Loved it" },
  { id: "too-sweet", label: "Too sweet" },
  { id: "faded-fast", label: "Faded fast" },
  { id: "overpowering", label: "Overpowering" },
  { id: "muddled", label: "Smelled muddled" },
  { id: "wrong-occasion", label: "Wrong for the occasion" },
] as const;
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number]["id"];

/** One wear of a combo, as logged by the user. The snapshot is the combo's score breakdown at logging time. */
export interface FeedbackEvent {
  id: string;
  at: string; // ISO
  rating: 1 | 2 | 3 | 4 | 5;
  tags: FeedbackTag[];
  snapshot: { terms: ComboTerms; cells: CellShare[]; size: number; penaltyRules?: PenaltyRule[] };
}

/** All logged wears of one saved combo. */
export interface ComboFeedback {
  comboId: string;
  events: FeedbackEvent[];
}

export const MIN_SAMPLES = 3; // distinct combos before anything moves (framework: "roughly 3-5")
const CELL_ALPHA = 0.25; // EMA rate for the most prominent cell of a fully-confident combo
// Cells a combo is attributed to: its top few Harmony cells (the snapshot
// carries them in order). Relative, not an absolute share cutoff - real
// profiles spread accord mass thinly across dozens of cells.
const CELLS_PER_COMBO = 3;
const HARD_AVOID_AT = -0.5; // average rating target at or below which a cell becomes a hard-avoid
const WEIGHT_STEP = 0.03;
const WEIGHT_MAX_DELTA = 0.15;

export interface PersonalModel extends PersonalLayer {
  wearsCount: number;
  combosCount: number;
  weightDeltas: { harmony: number; structure: number; interest: number; context: number };
  sweetnessCapDelta: number;
  strengthThresholdDelta: number;
  sprayMultiplierDelta: number;
  adjustments: string[]; // human-readable summary of what's currently in effect
}

const ratingTarget = (rating: number) => (rating - 3) / 2; // 1..5 -> -1..1

/** Confidence in a combo's verdict: grows with repeat wears (1 wear 0.5, 2 -> 0.75, 3 -> 0.875...). */
const confidence = (wears: number) => 1 - 0.5 ** wears;

interface ComboSummary {
  lastAt: string;
  wears: number;
  meanTarget: number;
  meanRating: number;
  tags: Set<FeedbackTag>; // any wear
  latest: FeedbackEvent["snapshot"];
}

function summarize(c: ComboFeedback): ComboSummary | null {
  if (c.events.length === 0) return null;
  const events = [...c.events].sort((a, b) => a.at.localeCompare(b.at));
  const meanRating = events.reduce((sum, e) => sum + e.rating, 0) / events.length;
  return {
    lastAt: events[events.length - 1].at,
    wears: events.length,
    meanRating,
    meanTarget: ratingTarget(meanRating),
    tags: new Set(events.flatMap((e) => e.tags)),
    latest: events[events.length - 1].snapshot,
  };
}

export function buildPersonalModel(combos: ComboFeedback[]): PersonalModel {
  const summaries = combos.map(summarize).filter((s): s is ComboSummary => s !== null);
  summaries.sort((a, b) => a.lastAt.localeCompare(b.lastAt));

  const cells = new Map<string, { value: number; count: number; targetSum: number }>();
  const tagCombos: Partial<Record<FeedbackTag, number>> = {};
  let boldLoves = 0; // loved a high-Interest, lower-Harmony combo
  let sweetLoves = 0; // loved a combo that tripped the sweetness cap

  for (const c of summaries) {
    const involved = [...c.latest.cells]
      .sort((a, b) => b.share - a.share)
      .slice(0, CELLS_PER_COMBO)
      .filter((cell) => cell.share > 0);
    const maxShare = Math.max(0, ...involved.map((cell) => cell.share));
    for (const cell of involved) {
      const state = cells.get(cell.key) ?? { value: DEFAULT_AFFINITY[cell.key] ?? 0, count: 0, targetSum: 0 };
      const alpha = CELL_ALPHA * (cell.share / maxShare) * confidence(c.wears);
      state.value += alpha * (c.meanTarget - state.value);
      state.count += 1;
      state.targetSum += c.meanTarget;
      cells.set(cell.key, state);
    }

    for (const t of c.tags) tagCombos[t] = (tagCombos[t] ?? 0) + 1;
    const loved = c.tags.has("loved-it") || c.meanRating >= 4;
    const { interest, harmony } = c.latest.terms;
    if (c.tags.has("loved-it") && interest >= 0.6 && harmony < interest) boldLoves += 1;
    if (loved && !c.tags.has("too-sweet") && c.latest.penaltyRules?.includes("sweetness")) sweetLoves += 1;
  }

  const matrixOverrides: Record<string, number> = {};
  const hardAvoid: string[] = [];
  for (const [key, s] of cells) {
    if (s.count < MIN_SAMPLES) continue;
    matrixOverrides[key] = Math.round(Math.max(-1, Math.min(1, s.value)) * 1000) / 1000;
    if (s.targetSum / s.count <= HARD_AVOID_AT) hardAvoid.push(key);
  }

  const counted = (n: number, step: number, maxAbs: number) =>
    n >= MIN_SAMPLES ? Math.sign(step) * Math.min(maxAbs, Math.abs(step) * n) : 0;
  const weightDeltas = {
    harmony: 0,
    structure: counted(tagCombos["muddled"] ?? 0, WEIGHT_STEP, WEIGHT_MAX_DELTA),
    interest: counted(boldLoves, WEIGHT_STEP, WEIGHT_MAX_DELTA),
    context: counted(tagCombos["wrong-occasion"] ?? 0, WEIGHT_STEP, WEIGHT_MAX_DELTA),
  };
  const sweetnessCapDelta =
    counted(tagCombos["too-sweet"] ?? 0, -0.05, 0.4) + counted(sweetLoves, 0.05, 0.4);
  const strengthThresholdDelta = counted(tagCombos["overpowering"] ?? 0, -0.25, 1);
  const sprayMultiplierDelta = counted(tagCombos["faded-fast"] ?? 0, 0.1, 0.5);

  const adjustments: string[] = [];
  const nOverrides = Object.keys(matrixOverrides).length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (nOverrides) adjustments.push(`${plural(nOverrides, "accord pairing")} tuned to your ratings`);
  if (hardAvoid.length) adjustments.push(`${plural(hardAvoid.length, "pairing")} you consistently dislike are never suggested`);
  if (weightDeltas.interest) adjustments.push("Favoring bolder contrast (you love adventurous combos)");
  if (weightDeltas.structure) adjustments.push("Stricter about anchor/modifier structure (muddled feedback)");
  if (weightDeltas.context) adjustments.push("Weighting context more (wrong-for-the-occasion feedback)");
  if (sweetnessCapDelta < 0) adjustments.push(`Sweetness cap lowered by ${Math.abs(sweetnessCapDelta).toFixed(2)} (too-sweet feedback)`);
  if (sweetnessCapDelta > 0) adjustments.push(`Sweetness cap raised by ${sweetnessCapDelta.toFixed(2)} (you enjoy sweeter combos)`);
  if (strengthThresholdDelta) adjustments.push(`Strength mismatch tolerance lowered by ${Math.abs(strengthThresholdDelta).toFixed(2)} (overpowering feedback)`);
  if (sprayMultiplierDelta) adjustments.push(`Spraying ${Math.round(sprayMultiplierDelta * 100)}% more (faded-fast feedback)`);

  return {
    wearsCount: summaries.reduce((sum, c) => sum + c.wears, 0),
    combosCount: summaries.length,
    matrixOverrides,
    hardAvoid,
    weightDeltas,
    sweetnessCapDelta,
    strengthThresholdDelta,
    sprayMultiplierDelta,
    adjustments,
  };
}

/** The user's chosen settings with their personal-layer nudges applied on top. */
export function applyPersonalModel(s: IntelliScentSettings, m: PersonalModel): IntelliScentSettings {
  const w = s.weights;
  return {
    ...s,
    weights: {
      harmony: Math.max(0, w.harmony + m.weightDeltas.harmony),
      structure: Math.max(0, w.structure + m.weightDeltas.structure),
      interest: Math.max(0, w.interest + m.weightDeltas.interest),
      context: Math.max(0, w.context + m.weightDeltas.context),
    },
    sweetnessCap: Math.max(0.2, s.sweetnessCap + m.sweetnessCapDelta),
    strengthMismatchThreshold: Math.max(0.5, s.strengthMismatchThreshold + m.strengthThresholdDelta),
    sprayMultiplier: Math.min(2, Math.max(0.5, s.sprayMultiplier + m.sprayMultiplierDelta)),
  };
}
