import type { AffinityMatrix } from "@/lib/intelliscent/affinity";
import type { IntelliScentSettings } from "@/lib/intelliscent/settings";

/** Everything the engine needs besides the profiles themselves. */
export interface EngineContext {
  settings: IntelliScentSettings;
  matrix: AffinityMatrix; // baseline affinity with any personal cell adjustments applied
  hardAvoid: ReadonlySet<string>; // affinity cell keys the user consistently dislikes - never suggested
  clashPairs: ReadonlySet<string>; // pairKey()s of fragrances known to clash (curated + personal)
}

/** "anchor" (base-heavy, goes on first), "modifier" (the main partner), "accent" (a light single-facet lift, 3+ combos). */
export type Role = "anchor" | "modifier" | "accent";

export type PenaltyRule = "sweetness" | "molecule" | "clash" | "strength" | "accent";

export interface Penalty {
  rule: PenaltyRule;
  amount: number; // subtracted from the 0-1 score
  detail: string;
}

export interface CellShare {
  key: string; // affinity cell, e.g. "citrus|dryWoods"
  share: number; // fraction of the combo's accord mass that falls in this cell
  affinity: number; // the matrix value used
}

export interface ComboTerms {
  harmony: number; // 0-1
  structure: number; // 0-1
  interest: number; // 0-1
  context: number | null; // 0-1, or null when no context filter is active (term dropped, weights renormalized)
}

export interface ScoredCombo {
  fragranceIds: number[]; // in role order: anchor, modifier, then accents
  roles: Role[];
  score: number; // 0-1, after penalties
  terms: ComboTerms;
  weights: { harmony: number; structure: number; interest: number; context: number }; // normalized, as applied
  penalties: Penalty[];
  structureNote: string | null; // why Structure failed or was limited, if it did
  cells: CellShare[]; // top Harmony contributors - drives explanations and personalization
  avoidedCells: string[]; // personal hard-avoid cells this combo leans on
  lateWeights: number[]; // role order
  strengths: number[]; // role order
}

export interface RecipeStep {
  fragranceId: number;
  role: Role;
  sprays: number;
  placement: string;
}

export interface Recipe {
  steps: RecipeStep[]; // in application order
  description: string; // predicted blend, in plain language
  skinTest: string;
}

export function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}
