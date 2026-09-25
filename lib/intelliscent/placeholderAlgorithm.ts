// PLACEHOLDER IntelliScent implementation - stands in until the real
// algorithm is written, so the UI and API can be built and exercised end
// to end. It's deliberately simple and heuristic; don't tune it, replace it.
//
// Shape: each IntelliScent param id maps to a "feature" (a 0..1 measurement
// of a candidate or combo). A param's slider value is the *target* for its
// feature, and a candidate's score is how close its features land to the
// targets, averaged. Params with no feature here are ignored, so the param
// registry can grow ahead of the algorithm without breaking anything.

import type { Fragrance } from "@/lib/schemas";
import { paramUnit, type IntelliScentParams } from "@/lib/intelliscent/params";
import type { ComboRating, IntelliScentAlgorithm, PairScore, ScoredCandidate } from "@/lib/intelliscent/types";

// Rough "how loud does this accord read" weights, 0 (airy) .. 1 (heavy).
// Unlisted accords count as 0.5. Heuristic only.
const ACCORD_LOUDNESS: Record<string, number> = {
  oud: 1, leather: 0.95, animalic: 0.95, smoky: 0.9, tobacco: 0.9, amber: 0.85,
  balsamic: 0.8, "warm spicy": 0.8, patchouli: 0.75, tuberose: 0.75, caramel: 0.7,
  honey: 0.7, cinnamon: 0.7, coffee: 0.7, rum: 0.7, whiskey: 0.7, vanilla: 0.65,
  sweet: 0.65, woody: 0.6, earthy: 0.6, "white floral": 0.55, rose: 0.5, "soft spicy": 0.5,
  musky: 0.45, floral: 0.45, fruity: 0.45, aromatic: 0.45, powdery: 0.4, iris: 0.4,
  lavender: 0.4, "fresh spicy": 0.4, aldehydic: 0.4, herbal: 0.35, green: 0.3,
  citrus: 0.2, fresh: 0.2, aquatic: 0.2, marine: 0.2, ozonic: 0.2,
};

type AccordVector = Map<string, number>;

function accordVector(f: Fragrance): AccordVector {
  return new Map(f.accords.map((a) => [a.name.toLowerCase(), a.strength / 100]));
}

function cosine(a: AccordVector, b: AccordVector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, v] of a) {
    normA += v * v;
    const w = b.get(k);
    if (w !== undefined) dot += v * w;
  }
  for (const v of b.values()) normB += v * v;
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
}

function intensity(f: Fragrance): number {
  let weighted = 0;
  let total = 0;
  for (const a of f.accords) {
    weighted += (ACCORD_LOUDNESS[a.name.toLowerCase()] ?? 0.5) * a.strength;
    total += a.strength;
  }
  return total === 0 ? 0.5 : weighted / total;
}

/** 1 = obscure, 0 = the most-voted fragrance in the pool. Unknown vote counts read as obscure. */
function obscurity(f: Fragrance, maxRatingCount: number): number {
  if (f.ratingCount == null) return 1;
  if (maxRatingCount <= 0) return 1;
  return 1 - Math.log10(f.ratingCount + 1) / Math.log10(maxRatingCount + 1);
}

interface CandidateContext {
  base: Fragrance;
  candidate: Fragrance;
  similarity: number; // precomputed cosine(base, candidate)
  maxRatingCount: number;
}

// param id -> feature. Add an entry here when a new param is registered.
const CANDIDATE_FEATURES: Record<string, (ctx: CandidateContext) => number> = {
  boldness: ({ base, candidate }) => (intensity(base) + intensity(candidate)) / 2,
  similarity: ({ similarity }) => similarity,
  reach: ({ candidate, maxRatingCount }) => obscurity(candidate, maxRatingCount),
};

function fit(feature: number, target: number): number {
  return 1 - Math.abs(feature - target);
}

function scoreCandidate(ctx: CandidateContext, params: IntelliScentParams): number {
  const fits = Object.keys(params)
    .filter((id) => id in CANDIDATE_FEATURES)
    .map((id) => fit(CANDIDATE_FEATURES[id](ctx), paramUnit(params, id)));
  return fits.length === 0 ? 50 : Math.round((100 * fits.reduce((a, b) => a + b, 0)) / fits.length);
}

function topAccordNames(f: Fragrance, filter: (name: string) => boolean, n: number): string[] {
  return [...f.accords]
    .filter((a) => filter(a.name.toLowerCase()))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, n)
    .map((a) => a.name);
}

function explain(base: Fragrance, candidate: Fragrance, similarity: number): string {
  const baseAccords = new Set(base.accords.map((a) => a.name.toLowerCase()));
  const shared = topAccordNames(candidate, (n) => baseAccords.has(n), 2);
  const novel = topAccordNames(candidate, (n) => !baseAccords.has(n), 2);
  if (similarity >= 0.5 && shared.length > 0) return `Reinforces ${shared.join(" & ")}`;
  if (novel.length > 0) return `Adds ${novel.join(" & ")}`;
  if (shared.length > 0) return `Shares ${shared.join(" & ")}`;
  return "Not enough accord data to explain";
}

function ratingLabel(score: number): string {
  if (score >= 80) return "Excellent pairing";
  if (score >= 65) return "Strong pairing";
  if (score >= 45) return "Worth a try";
  return "Likely to clash";
}

export const placeholderAlgorithm: IntelliScentAlgorithm = {
  info: { id: "placeholder-accords", name: "IntelliScent (placeholder)", version: "0.1.0", isPlaceholder: true },

  suggest(base, pool, params, limit): ScoredCandidate[] {
    const baseVector = accordVector(base);
    const maxRatingCount = Math.max(0, ...[base, ...pool].map((f) => f.ratingCount ?? 0));

    return pool
      .filter((c) => c.id != null && c.id !== base.id)
      .map((candidate) => {
        const similarity = cosine(baseVector, accordVector(candidate));
        const ctx = { base, candidate, similarity, maxRatingCount };
        return {
          fragranceId: candidate.id!,
          score: scoreCandidate(ctx, params),
          reason: explain(base, candidate, similarity),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  // Rating ignores `reach` - that's about discovering new scents, not about
  // whether a chosen set works together.
  rateCombo(fragrances, params): ComboRating {
    const vectors = fragrances.map(accordVector);
    const pairs: PairScore[] = [];
    let cosineSum = 0;
    const similarityTarget = paramUnit(params, "similarity");

    for (let i = 0; i < fragrances.length; i++) {
      for (let j = i + 1; j < fragrances.length; j++) {
        const c = cosine(vectors[i], vectors[j]);
        cosineSum += c;
        pairs.push({
          aId: fragrances[i].id!,
          bId: fragrances[j].id!,
          score: Math.round(100 * fit(c, similarityTarget)),
        });
      }
    }

    const meanCosine = pairs.length === 0 ? 0 : cosineSum / pairs.length;
    const meanIntensity = fragrances.reduce((sum, f) => sum + intensity(f), 0) / fragrances.length;
    const score = Math.round(
      (100 * (fit(meanCosine, similarityTarget) + fit(meanIntensity, paramUnit(params, "boldness")))) / 2
    );

    return { score, label: ratingLabel(score), pairs };
  },
};
