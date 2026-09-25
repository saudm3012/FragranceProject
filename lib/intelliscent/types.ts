import type { Fragrance } from "@/lib/schemas";
import type { IntelliScentParams } from "@/lib/intelliscent/params";

export interface AlgorithmInfo {
  id: string;
  name: string;
  version: string;
  isPlaceholder: boolean; // surfaced in the UI so placeholder output is never mistaken for the real thing
}

export interface ScoredCandidate {
  fragranceId: number;
  score: number; // 0-100
  reason: string; // one short human-readable line
}

export interface PairScore {
  aId: number;
  bId: number;
  score: number; // 0-100
}

export interface ComboRating {
  score: number; // 0-100
  label: string;
  pairs: PairScore[];
}

/**
 * The contract any IntelliScent implementation must satisfy. Everything
 * else (API, service, UI) talks to this interface only, so the real
 * algorithm can replace the placeholder by swapping one export in index.ts.
 */
export interface IntelliScentAlgorithm {
  info: AlgorithmInfo;
  /** Rank `pool` by how well each would layer with `base`. Highest first. */
  suggest(base: Fragrance, pool: Fragrance[], params: IntelliScentParams, limit: number): ScoredCandidate[];
  /** Score a combination of 2+ fragrances worn together. */
  rateCombo(fragrances: Fragrance[], params: IntelliScentParams): ComboRating;
}

// --- API request/response shapes, shared by the route handlers and the client ---

export interface SuggestRequest {
  fragranceId: number;
  params: IntelliScentParams;
  poolIds?: number[]; // restrict candidates to these (e.g. the user's collection); omit for every cached fragrance
  limit?: number;
}

export interface SuggestResponse {
  algorithm: AlgorithmInfo;
  params: IntelliScentParams; // as normalized and actually used
  poolSize: number;
  suggestions: Array<ScoredCandidate & { fragrance: Fragrance }>;
}

export interface RateRequest {
  fragranceIds: number[];
  params: IntelliScentParams;
}

export interface RateResponse {
  algorithm: AlgorithmInfo;
  params: IntelliScentParams;
  rating: ComboRating;
}
