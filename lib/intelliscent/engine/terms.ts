// The four score terms from the framework, each on a 0-1 scale.
// Two deliberate deviations from the formulas as literally written, both
// scale fixes so the 0.35/0.25/0.20/0.20 weights mean what they intend:
//   - Harmony: A^T M B is divided by (sum A)(sum B), making it the
//     accord-mass-weighted average affinity (-1..1), then mapped to 0..1.
//     Unnormalized, it grows with how many accords a scent has.
//   - Structure: |lateWeight(A) - lateWeight(B)| is divided by 0.5, the
//     largest gap two non-increasing time profiles can have.

import { cellKey, affinity, type AffinityMatrix } from "@/lib/intelliscent/affinity";
import { AXIS_IDS, cosineSimilarity, vectorSum } from "@/lib/intelliscent/axes";
import { lateWeight, type FragranceProfile } from "@/lib/intelliscent/profile";
import type { IntelliScentSettings } from "@/lib/intelliscent/settings";
import type { CellShare } from "@/lib/intelliscent/engine/types";

const MAX_LATE_GAP = 0.5;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface PairHarmony {
  value: number; // 0-1
  cellWeights: Map<string, number>; // cell -> share of accord mass
}

export function harmonyPair(a: FragranceProfile, b: FragranceProfile, matrix: AffinityMatrix): PairHarmony {
  const denom = vectorSum(a.accords) * vectorSum(b.accords);
  const cellWeights = new Map<string, number>();
  if (denom === 0) return { value: 0.5, cellWeights };

  let weighted = 0;
  for (const i of AXIS_IDS) {
    const ai = a.accords[i];
    if (ai === 0) continue;
    for (const j of AXIS_IDS) {
      const w = ai * b.accords[j];
      if (w === 0) continue;
      weighted += w * affinity(matrix, i, j);
      const key = cellKey(i, j);
      cellWeights.set(key, (cellWeights.get(key) ?? 0) + w / denom);
    }
  }
  return { value: clamp01((weighted / denom + 1) / 2), cellWeights };
}

/** Framework: Interest = exp(-(d - center)^2 / (2 * width)), d = cosine distance. */
export function interestPair(a: FragranceProfile, b: FragranceProfile, s: IntelliScentSettings): number {
  const d = 1 - cosineSimilarity(a.accords, b.accords);
  return Math.exp(-((d - s.interestCenter) ** 2) / (2 * s.interestWidth));
}

export function structurePair(a: FragranceProfile, b: FragranceProfile): number {
  return clamp01(Math.abs(lateWeight(a) - lateWeight(b)) / MAX_LATE_GAP);
}

/**
 * Framework, 3+ scents: exactly one anchor, everything else not competing
 * with it. "Anchor" is relative to the combo, not a fixed property of a
 * bottle: the most base-heavy member is the anchor only if its late weight
 * beats the runner-up's by `anchorMargin`. If not, the members share too
 * similar a shape to have a real anchor and Structure hard-fails. When it
 * holds, the score is the average anchor-to-member gap, on the pair scale.
 */
export function structureSet(
  ordered: FragranceProfile[], // role order, anchor first
  s: IntelliScentSettings,
  nameOf: (p: FragranceProfile) => string
): { value: number; note: string | null } {
  const [anchor, ...rest] = ordered;
  const runnerUp = rest.reduce((best, p) => (lateWeight(p) > lateWeight(best) ? p : best), rest[0]);
  const margin = lateWeight(anchor) - lateWeight(runnerUp);
  if (margin < s.anchorMargin) {
    return {
      value: 0,
      note: `No clear anchor: ${nameOf(anchor)} and ${nameOf(runnerUp)} fade on a similar curve, so they'll compete for the drydown.`,
    };
  }
  const gaps = rest.map((p) => clamp01((lateWeight(anchor) - lateWeight(p)) / MAX_LATE_GAP));
  return { value: gaps.reduce((x, y) => x + y, 0) / gaps.length, note: null };
}

/**
 * Framework: "a 0-1 match score against whatever filter the user has
 * active". Per active dimension, each member's best score among the
 * selected options, averaged over members; dimensions averaged. Null when
 * nothing is selected - no filter means context doesn't apply.
 */
export function contextScore(members: FragranceProfile[], s: IntelliScentSettings): number | null {
  const dims: number[] = [];
  const memberMean = (score: (p: FragranceProfile) => number) =>
    members.reduce((sum, p) => sum + score(p), 0) / members.length;

  const { seasons, timeOfDay, occasions } = s.context;
  if (seasons.length) dims.push(memberMean((p) => Math.max(...seasons.map((x) => p.context.seasons[x]))));
  if (timeOfDay.length) dims.push(memberMean((p) => Math.max(...timeOfDay.map((x) => p.context.timeOfDay[x]))));
  if (occasions.length) dims.push(memberMean((p) => Math.max(...occasions.map((x) => p.context.occasions[x]))));
  return dims.length === 0 ? null : dims.reduce((a, b) => a + b, 0) / dims.length;
}

/** The strongest Harmony contributors across all pairs, averaged, for explanation and feedback. */
export function topCells(pairs: PairHarmony[], matrix: AffinityMatrix, limit = 6): CellShare[] {
  const totals = new Map<string, number>();
  for (const p of pairs) {
    for (const [key, share] of p.cellWeights) totals.set(key, (totals.get(key) ?? 0) + share / pairs.length);
  }
  return [...totals.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([key, share]) => ({ key, share: Math.round(share * 1000) / 1000, affinity: matrix[key] ?? 0 }));
}
