// Scores one combo (2-4 fragrances) per the framework:
//   score = w_H*Harmony + w_S*Structure + w_I*Interest + w_C*Context - Penalties
// with pairs and 3+ scent sets handled as the framework describes
// (roles; Harmony and Interest averaged over pairs; Structure as a role
// check; penalties tightening with size).

import { MOLECULES, strength, lateWeight, type FragranceProfile } from "@/lib/intelliscent/profile";
import {
  contextScore,
  harmonyPair,
  interestPair,
  structurePair,
  structureSet,
  topCells,
  type PairHarmony,
} from "@/lib/intelliscent/engine/terms";
import { pairKey, type EngineContext, type Penalty, type Role, type ScoredCombo } from "@/lib/intelliscent/engine/types";

/**
 * How hard each rule bites. The framework says penalties should push a
 * combo out of the top results without making it impossible (ours - it
 * gives no numbers).
 */
export const PENALTY_AMOUNTS = {
  sweetness: 0.15,
  molecule: 0.12,
  clash: 0.3,
  strength: 0.15,
  accent: 0.1,
} as const;

const MOLECULE_FLAG_MIN = 0.5; // flag intensity at which a scent "carries" a molecule
// A combo "leans on" a pairing if it's among its top few Harmony cells. Relative
// on purpose: real profiles spread their accord mass over dozens of cells, so
// even the dominant cell rarely holds more than a few percent in absolute terms.
const LEANS_ON_TOP_CELLS = 3;

/**
 * Anchor = the most base-heavy member (highest late weight). Of the rest,
 * the strongest is the primary modifier; any others are accents.
 */
export function assignRoles(members: FragranceProfile[]): { ordered: FragranceProfile[]; roles: Role[] } {
  const byLate = [...members].sort((a, b) => lateWeight(b) - lateWeight(a) || b.longevity - a.longevity);
  const [anchor, ...rest] = byLate;
  const others = rest.sort((a, b) => strength(b) - strength(a));
  const ordered = [anchor, ...others];
  return { ordered, roles: ordered.map((_, i): Role => (i === 0 ? "anchor" : i === 1 ? "modifier" : "accent")) };
}

function penaltiesFor(
  ordered: FragranceProfile[],
  ctx: EngineContext,
  nameOf: (p: FragranceProfile) => string
): Penalty[] {
  const s = ctx.settings;
  const n = ordered.length;
  const penalties: Penalty[] = [];

  // Sweetness stacks additively, so the cap grows with size - but slower than the sum does.
  const sweetCap = s.sweetnessCap + s.sweetnessCapPerExtraScent * (n - 2);
  const totalSweet = ordered.reduce((sum, p) => sum + p.sweetness, 0);
  if (totalSweet > sweetCap) {
    penalties.push({
      rule: "sweetness",
      amount: PENALTY_AMOUNTS.sweetness,
      detail: `Combined sweetness ${totalSweet.toFixed(2)} is over the ${sweetCap.toFixed(2)} cap - likely cloying.`,
    });
  }

  for (const m of MOLECULES) {
    if (!s.moleculeFlags.includes(m.id)) continue;
    const carriers = ordered.filter((p) => p.molecules[m.id] >= MOLECULE_FLAG_MIN);
    if (carriers.length >= 2) {
      penalties.push({
        rule: "molecule",
        amount: PENALTY_AMOUNTS.molecule,
        detail: `${carriers.map(nameOf).join(" and ")} both lean on ${m.label} - doubling it can smell harsh.`,
      });
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (ctx.clashPairs.has(pairKey(ordered[i].fragranceId, ordered[j].fragranceId))) {
        penalties.push({
          rule: "clash",
          amount: PENALTY_AMOUNTS.clash,
          detail: `${nameOf(ordered[i])} and ${nameOf(ordered[j])} are on the clash list.`,
        });
      }
    }
  }

  // Strength mismatch only between anchor and primary modifier - accents are meant to be weaker.
  const gap = Math.abs(strength(ordered[0]) - strength(ordered[1]));
  if (gap > s.strengthMismatchThreshold) {
    penalties.push({
      rule: "strength",
      amount: PENALTY_AMOUNTS.strength,
      detail: `Strength gap of ${gap.toFixed(1)} between ${nameOf(ordered[0])} and ${nameOf(ordered[1])} - the weaker one may disappear (the spray ratio compensates).`,
    });
  }

  for (const accent of ordered.slice(2)) {
    if (strength(accent) > s.accentMaxStrength) {
      penalties.push({
        rule: "accent",
        amount: PENALTY_AMOUNTS.accent,
        detail: `${nameOf(accent)} is too strong for an accent (${strength(accent).toFixed(1)} > ${s.accentMaxStrength}).`,
      });
    }
  }

  return penalties;
}

export function scoreCombo(
  members: FragranceProfile[],
  ctx: EngineContext,
  nameOf: (p: FragranceProfile) => string = (p) => `#${p.fragranceId}`
): ScoredCombo {
  if (members.length < 2) throw new Error("A combo needs at least 2 fragrances");
  const s = ctx.settings;
  const { ordered, roles } = assignRoles(members);

  const pairHarmonies: PairHarmony[] = [];
  const interests: number[] = [];
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      pairHarmonies.push(harmonyPair(ordered[i], ordered[j], ctx.matrix));
      interests.push(interestPair(ordered[i], ordered[j], s));
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const harmony = mean(pairHarmonies.map((p) => p.value));
  const interest = mean(interests);

  const structure =
    ordered.length === 2
      ? { value: structurePair(ordered[0], ordered[1]), note: null }
      : structureSet(ordered, s, nameOf);
  const context = contextScore(ordered, s);

  // Weights are relative; context drops out (and the rest rescale) when no filter is set.
  const raw = { ...s.weights, context: context === null ? 0 : s.weights.context };
  const total = raw.harmony + raw.structure + raw.interest + raw.context || 1;
  const weights = {
    harmony: raw.harmony / total,
    structure: raw.structure / total,
    interest: raw.interest / total,
    context: raw.context / total,
  };

  const penalties = penaltiesFor(ordered, ctx, nameOf);
  const base =
    weights.harmony * harmony +
    weights.structure * structure.value +
    weights.interest * interest +
    weights.context * (context ?? 0);
  const score = Math.max(0, Math.min(1, base - penalties.reduce((sum, p) => sum + p.amount, 0)));

  const cells = topCells(pairHarmonies, ctx.matrix);
  const avoidedCells = cells
    .slice(0, LEANS_ON_TOP_CELLS)
    .map((c) => c.key)
    .filter((key) => ctx.hardAvoid.has(key));

  const round = (x: number) => Math.round(x * 1000) / 1000;
  return {
    fragranceIds: ordered.map((p) => p.fragranceId),
    roles,
    score: round(score),
    terms: { harmony: round(harmony), structure: round(structure.value), interest: round(interest), context: context === null ? null : round(context) },
    weights: { harmony: round(weights.harmony), structure: round(weights.structure), interest: round(weights.interest), context: round(weights.context) },
    penalties,
    structureNote: structure.note,
    cells,
    avoidedCells,
    lateWeights: ordered.map((p) => round(lateWeight(p))),
    strengths: ordered.map((p) => round(strength(p))),
  };
}
