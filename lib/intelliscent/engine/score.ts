// Scores one combo (2-4 fragrances) per the framework:
//   score = w_H*Harmony + w_S*Structure + w_I*Interest + w_C*Context - Penalties
// Pairs use the framework's pairwise terms directly. 3+ scents use roles:
// an anchor, the modifier that best complements it, and accents - which
// are judged against the anchor+modifier blend (the one scent field they
// actually land on), not against each member separately.

import { MOLECULES, strength, lateWeight, type FragranceProfile } from "@/lib/intelliscent/profile";
import { blendOf, spraysFor } from "@/lib/intelliscent/engine/sprays";
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
 * How hard each rule bites. The threshold rules are graduated - barely
 * over the line reads mildly off, far over reads unwearable - as
 * `min + perUnit * (distance past the line)`, capped at `max`. The clash
 * list is categorical (a curated or confirmed "no"), so it's flat and harsh.
 */
export const PENALTIES = {
  sweetness: { min: 0.05, perUnit: 0.3, max: 0.3 }, // per unit of combined sweetness over the cap
  molecule: { min: 0.06, perUnit: 0.24, max: 0.18 }, // per unit the weaker carrier sits above the carrying line
  strength: { min: 0.05, perUnit: 0.1, max: 0.25 }, // per strength point past the mismatch threshold
  accent: { min: 0.05, perUnit: 0.1, max: 0.2 }, // per strength point past the accent maximum
  clash: 0.35,
} as const;

function graduated(rule: { min: number; perUnit: number; max: number }, over: number): number {
  return Math.round(Math.min(rule.max, rule.min + rule.perUnit * Math.max(0, over)) * 1000) / 1000;
}

const MOLECULE_FLAG_MIN = 0.5; // flag intensity at which a scent "carries" a molecule
// A combo "leans on" a pairing if it's among its top few Harmony cells. Relative
// on purpose: real profiles spread their accord mass over dozens of cells, so
// even the dominant cell rarely holds more than a few percent in absolute terms.
const LEANS_ON_TOP_CELLS = 3;

/**
 * Anchor = the most base-heavy member (highest late weight). The modifier
 * is whichever remaining scent harmonizes best with the anchor - its job is
 * to complement the anchor, which is a Harmony question, not a loudness
 * contest. Any others are accents, best-harmonizing first.
 */
export function assignRoles(
  members: FragranceProfile[],
  ctx: EngineContext
): { ordered: FragranceProfile[]; roles: Role[] } {
  const [anchor, ...rest] = [...members].sort((a, b) => lateWeight(b) - lateWeight(a) || b.longevity - a.longevity);
  const others = rest
    .map((p) => ({ p, h: harmonyPair(anchor, p, ctx.matrix).value }))
    .sort((a, b) => b.h - a.h)
    .map((x) => x.p);
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
      amount: graduated(PENALTIES.sweetness, totalSweet - sweetCap),
      detail: `Combined sweetness ${totalSweet.toFixed(2)} is over the ${sweetCap.toFixed(2)} cap - likely cloying.`,
    });
  }

  for (const m of MOLECULES) {
    if (!s.moleculeFlags.includes(m.id)) continue;
    const carriers = ordered
      .filter((p) => p.molecules[m.id] >= MOLECULE_FLAG_MIN)
      .sort((a, b) => b.molecules[m.id] - a.molecules[m.id]);
    if (carriers.length >= 2) {
      penalties.push({
        rule: "molecule",
        amount: graduated(PENALTIES.molecule, carriers[1].molecules[m.id] - MOLECULE_FLAG_MIN),
        detail: `${carriers.map(nameOf).join(" and ")} both lean on ${m.label} - doubling it can smell harsh.`,
      });
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (ctx.clashPairs.has(pairKey(ordered[i].fragranceId, ordered[j].fragranceId))) {
        penalties.push({
          rule: "clash",
          amount: PENALTIES.clash,
          detail: `${nameOf(ordered[i])} and ${nameOf(ordered[j])} are on the clash list.`,
        });
      }
    }
  }

  // Strength mismatch only between anchor and modifier - accents are meant to be weaker.
  const gap = Math.abs(strength(ordered[0]) - strength(ordered[1]));
  if (gap > s.strengthMismatchThreshold) {
    penalties.push({
      rule: "strength",
      amount: graduated(PENALTIES.strength, gap - s.strengthMismatchThreshold),
      detail: `Strength gap of ${gap.toFixed(1)} between ${nameOf(ordered[0])} and ${nameOf(ordered[1])} - the weaker one may disappear (the spray ratio compensates).`,
    });
  }

  for (const accent of ordered.slice(2)) {
    if (strength(accent) > s.accentMaxStrength) {
      penalties.push({
        rule: "accent",
        amount: graduated(PENALTIES.accent, strength(accent) - s.accentMaxStrength),
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
  const { ordered, roles } = assignRoles(members, ctx);
  const [anchor, modifier, ...accents] = ordered;

  // The core pair, then each accent against the anchor+modifier blend.
  const blend = blendOf([
    { profile: anchor, sprays: spraysFor(anchor, "anchor", s) },
    { profile: modifier, sprays: spraysFor(modifier, "modifier", s) },
  ]);
  const comparisons: Array<[FragranceProfile, FragranceProfile]> = [
    [anchor, modifier],
    ...accents.map((a): [FragranceProfile, FragranceProfile] => [blend, a]),
  ];
  const pairHarmonies: PairHarmony[] = comparisons.map(([a, b]) => harmonyPair(a, b, ctx.matrix));
  const interests = comparisons.map(([a, b]) => interestPair(a, b, s));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const harmony = mean(pairHarmonies.map((p) => p.value));
  const interest = mean(interests);

  const structure =
    ordered.length === 2 ? { value: structurePair(anchor, modifier), note: null } : structureSet(ordered, s, nameOf);
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

