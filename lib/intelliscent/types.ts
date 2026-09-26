// Request/response shapes for the IntelliScent API, shared by the route
// handlers and the browser client.

import type { PersonalLayer, Recipe, ScoredCombo } from "@/lib/intelliscent/engine";
import type { FragranceProfile, ProfileOverride } from "@/lib/intelliscent/profile";
import type { IntelliScentSettings } from "@/lib/intelliscent/settings";
import type { Fragrance } from "@/lib/schemas";

/** Everything per-user the engine needs. All of it lives client-side until real accounts exist. */
export interface EnginePayload {
  settings: IntelliScentSettings; // effective settings (personal nudges already applied)
  personal?: PersonalLayer | null;
  overrides?: Record<string, ProfileOverride>; // fragranceId -> hand corrections
  clashPairs?: Array<[number, number]>; // personal clash list
}

export interface ComboResult extends ScoredCombo {
  recipe: Recipe;
}

export interface SuggestRequest extends EnginePayload {
  baseId?: number | null; // omit for "best combos in this pool"
  poolIds?: number[]; // restrict to these (e.g. the collection); omit for every cached fragrance
  limit?: number;
}

export interface SuggestResponse {
  poolSize: number;
  results: ComboResult[];
  fragrances: Fragrance[]; // every fragrance referenced in results, for display
}

export interface RateRequest extends EnginePayload {
  fragranceIds: number[];
}

export interface RateResponse {
  result: ComboResult;
  fragrances: Fragrance[];
}

export interface ProfilesRequest {
  ids: number[];
  overrides?: Record<string, ProfileOverride>;
}

export interface ProfilesResponse {
  profiles: Array<{ estimated: FragranceProfile; effective: FragranceProfile }>;
}
