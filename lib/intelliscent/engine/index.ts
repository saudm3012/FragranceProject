import { DEFAULT_AFFINITY } from "@/lib/intelliscent/affinity";
import type { IntelliScentSettings } from "@/lib/intelliscent/settings";
import { pairKey, type EngineContext } from "@/lib/intelliscent/engine/types";

export { scoreCombo, assignRoles, PENALTY_AMOUNTS } from "@/lib/intelliscent/engine/score";
export { suggest } from "@/lib/intelliscent/engine/suggest";
export { buildRecipe, describeBlend, SKIN_TEST_NOTE } from "@/lib/intelliscent/engine/recipe";
export * from "@/lib/intelliscent/engine/types";

/** Personal-layer adjustments the engine applies on top of the shared baseline (see personalization.ts). */
export interface PersonalLayer {
  matrixOverrides: Record<string, number>; // cellKey -> value
  hardAvoid: string[]; // cellKeys
}

export function buildEngineContext(input: {
  settings: IntelliScentSettings;
  personal?: PersonalLayer | null;
  clashPairs?: Array<[number, number]>;
}): EngineContext {
  return {
    settings: input.settings,
    matrix: { ...DEFAULT_AFFINITY, ...(input.personal?.matrixOverrides ?? {}) },
    hardAvoid: new Set(input.personal?.hardAvoid ?? []),
    clashPairs: new Set((input.clashPairs ?? []).map(([a, b]) => pairKey(a, b))),
  };
}
