// Layer 1 of "How feedback improves future suggestions": the user's
// personal preference layer. Built by replaying all of a user's feedback
// in order - a pure function, so it can be recomputed any time and never
// drifts from the journal it came from.
//
//   - Each rating nudges the affinity cells the combo leaned on toward the
//     rating (exponential moving average), weighted by how much each cell
//     contributed. A cell only takes effect after MIN_SAMPLES ratings.
//   - Cells rated consistently low become personal hard-avoids.
//   - Reason tags nudge the specific knob the framework ties them to,
//     again only once MIN_SAMPLES of that tag exist.
//
// Layer 2 (shared corrections to fragrance profiles from many users) needs
// trustworthy identity to aggregate across users, so it waits for real
// accounts - see the plan.

import { DEFAULT_AFFINITY } from "@/lib/intelliscent/affinity";
import type { CellShare, ComboTerms } from "@/lib/intelliscent/engine/types";
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
  snapshot: { terms: ComboTerms; cells: CellShare[]; size: number };
}

export const MIN_SAMPLES = 3; // framework: "roughly 3-5 relevant ratings" before anything moves
const CELL_ALPHA = 0.25; // EMA rate for the most prominent cell in a rated combo
// Cells a rating is attributed to: the combo's top few Harmony cells (the
// snapshot already carries them in order). Relative, not an absolute share
// cutoff - real profiles spread accord mass thinly across dozens of cells.
const CELLS_PER_RATING = 3;
const HARD_AVOID_AT = -0.5; // average rating target at or below which a cell becomes a hard-avoid
const WEIGHT_STEP = 0.03;
const WEIGHT_MAX_DELTA = 0.15;

export interface PersonalModel extends PersonalLayer {
  ratingsCount: number;
  weightDeltas: { harmony: number; structure: number; interest: number; context: number };
  sweetnessCapDelta: number;
  strengthThresholdDelta: number;
  adjustments: string[]; // human-readable summary of what's currently in effect
}

const ratingTarget = (rating: number) => (rating - 3) / 2; // 1..5 -> -1..1

export function buildPersonalModel(events: FeedbackEvent[]): PersonalModel {
  const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const cells = new Map<string, { value: number; count: number; targetSum: number }>();
  const tagCounts: Record<string, number> = {};
  let boldLoves = 0; // "loved it" on a high-interest, lower-harmony combo

  for (const e of ordered) {
    const target = ratingTarget(e.rating);
    const involved = [...e.snapshot.cells]
      .sort((a, b) => b.share - a.share)
      .slice(0, CELLS_PER_RATING)
      .filter((c) => c.share > 0);
    const maxShare = Math.max(0, ...involved.map((c) => c.share));
    for (const c of involved) {
      const state = cells.get(c.key) ?? { value: DEFAULT_AFFINITY[c.key] ?? 0, count: 0, targetSum: 0 };
      const alpha = CELL_ALPHA * (c.share / maxShare);
      state.value += alpha * (target - state.value);
      state.count += 1;
      state.targetSum += target;
      cells.set(c.key, state);
    }
    for (const t of e.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    const { interest, harmony } = e.snapshot.terms;
    if (e.tags.includes("loved-it") && interest >= 0.6 && harmony < interest) boldLoves += 1;
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
    // "faded fast" (both top-heavy) and "muddled" (both base-heavy) are both Structure failures.
    structure: counted((tagCounts["faded-fast"] ?? 0) + (tagCounts["muddled"] ?? 0), WEIGHT_STEP, WEIGHT_MAX_DELTA),
    interest: counted(boldLoves, WEIGHT_STEP, WEIGHT_MAX_DELTA),
    context: counted(tagCounts["wrong-occasion"] ?? 0, WEIGHT_STEP, WEIGHT_MAX_DELTA),
  };
  const sweetnessCapDelta = counted(tagCounts["too-sweet"] ?? 0, -0.05, 0.4);
  const strengthThresholdDelta = counted(tagCounts["overpowering"] ?? 0, -0.25, 1);

  const adjustments: string[] = [];
  const nOverrides = Object.keys(matrixOverrides).length;
  if (nOverrides) adjustments.push(`${nOverrides} accord pairing${nOverrides === 1 ? "" : "s"} tuned to your ratings`);
  if (hardAvoid.length) adjustments.push(`${hardAvoid.length} pairing${hardAvoid.length === 1 ? "" : "s"} you consistently dislike are never suggested`);
  if (weightDeltas.interest) adjustments.push("Favoring bolder contrast (you love adventurous combos)");
  if (weightDeltas.structure) adjustments.push("Stricter about anchor/modifier structure (faded fast / muddled feedback)");
  if (weightDeltas.context) adjustments.push("Weighting context more (wrong-for-the-occasion feedback)");
  if (sweetnessCapDelta) adjustments.push(`Sweetness cap lowered by ${Math.abs(sweetnessCapDelta).toFixed(2)} (too-sweet feedback)`);
  if (strengthThresholdDelta) adjustments.push(`Strength mismatch tolerance lowered by ${Math.abs(strengthThresholdDelta).toFixed(2)} (overpowering feedback)`);

  return {
    ratingsCount: ordered.length,
    matrixOverrides,
    hardAvoid,
    weightDeltas,
    sweetnessCapDelta,
    strengthThresholdDelta,
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
  };
}
