// Generates ranked suggestions per the framework:
//   1. Score pairs - every (base, candidate) pair when a base scent is
//      given, or every pair in the pool ("best combos in my collection").
//   2. "Extend greedily, never search exhaustively": only pairs that clear
//      the pair bar get a third scent tried, and only accents that are
//      weak enough and add an axis the pair is missing entirely. An
//      extended set must still clear the bar its parent needed. Triples
//      extend to fours the same way (experimental mode only).
// Combos leaning on a personal hard-avoid cell are never suggested.

import { AXIS_IDS, dominantAxes, emptyVector, type AccordVector } from "@/lib/intelliscent/axes";
import { strength, type FragranceProfile } from "@/lib/intelliscent/profile";
import { scoreCombo } from "@/lib/intelliscent/engine/score";
import type { EngineContext, ScoredCombo } from "@/lib/intelliscent/engine/types";

const EXTEND_TOP_K = 10; // how many of the best sets get an extension attempt
const MISSING_AXIS_MAX = 0.25; // an accent's main axis must be below this in the set it joins

export interface SuggestInput {
  base: FragranceProfile | null;
  pool: FragranceProfile[]; // candidates (base excluded automatically)
  ctx: EngineContext;
  limit: number;
  nameOf?: (p: FragranceProfile) => string;
}

function comboKey(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join("+");
}

function combinedPresence(members: FragranceProfile[]): AccordVector {
  const v = emptyVector();
  for (const p of members) for (const id of AXIS_IDS) v[id] = Math.max(v[id], p.accords[id]);
  return v;
}

export interface SuggestStats {
  pairsScored: number;
  sweetnessTripped: number; // pairs that hit the sweetness cap - a signal about the collection, not just one combo
}

export function suggest({ base, pool, ctx, limit, nameOf }: SuggestInput): { results: ScoredCombo[]; stats: SuggestStats } {
  const s = ctx.settings;
  const byId = new Map(pool.map((p) => [p.fragranceId, p]));
  if (base) byId.set(base.fragranceId, base);
  const candidates = pool.filter((p) => p.fragranceId !== base?.fragranceId);
  const acceptable = (c: ScoredCombo) => c.avoidedCells.length === 0;

  const pairs: ScoredCombo[] = [];
  if (base) {
    for (const c of candidates) pairs.push(scoreCombo([base, c], ctx, nameOf));
  } else {
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) pairs.push(scoreCombo([candidates[i], candidates[j]], ctx, nameOf));
    }
  }

  const results = new Map<string, ScoredCombo>();
  for (const p of pairs.filter(acceptable)) results.set(comboKey(p.fragranceIds), p);

  function extend(sets: ScoredCombo[], bar: number): ScoredCombo[] {
    const extended: ScoredCombo[] = [];
    for (const set of sets.filter((x) => x.score > bar).sort((a, b) => b.score - a.score).slice(0, EXTEND_TOP_K)) {
      const members = set.fragranceIds.map((id) => byId.get(id)!);
      const present = combinedPresence(members);
      let best: ScoredCombo | null = null;
      for (const accent of candidates) {
        if (set.fragranceIds.includes(accent.fragranceId)) continue;
        if (strength(accent) > s.accentMaxStrength) continue;
        const mainAxis = dominantAxes(accent.accords)[0];
        if (!mainAxis || present[mainAxis] >= MISSING_AXIS_MAX) continue;
        const scored = scoreCombo([...members, accent], ctx, nameOf);
        if (acceptable(scored) && scored.score > bar && (!best || scored.score > best.score)) best = scored;
      }
      if (best && !results.has(comboKey(best.fragranceIds))) {
        results.set(comboKey(best.fragranceIds), best);
        extended.push(best);
      }
    }
    return extended;
  }

  if (s.maxComboSize >= 3) {
    const triples = extend([...results.values()], s.extendBars.pair);
    if (s.maxComboSize >= 4) extend(triples, s.extendBars.triple);
  }

  return {
    results: [...results.values()]
      .filter((c) => c.score >= s.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit),
    stats: {
      pairsScored: pairs.length,
      sweetnessTripped: pairs.filter((p) => p.penalties.some((x) => x.rule === "sweetness")).length,
    },
  };
}
