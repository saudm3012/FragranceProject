// IntelliScent's tunable inputs. This array is the single source of truth:
// the settings panel renders one slider per entry, saved settings are
// migrated against it (normalizeParams), and the API validates against it.
// To add or remove an input, edit this list - then teach the active
// algorithm (see index.ts) what the new id means. Algorithms must tolerate
// ids they don't recognize, and fall back to `default` for missing ones.

export interface IntelliScentParamDef {
  id: string;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  default: number;
  minLabel: string; // what the low end of the slider means
  maxLabel: string; // what the high end of the slider means
}

export type IntelliScentParams = Record<string, number>;

export const INTELLISCENT_PARAMS: readonly IntelliScentParamDef[] = [
  {
    id: "boldness",
    label: "Boldness",
    description: "How loud and statement-making the finished layer should be.",
    min: 0,
    max: 100,
    step: 1,
    default: 50,
    minLabel: "Subtle",
    maxLabel: "Bold",
  },
  {
    id: "similarity",
    label: "Similarity",
    description: "Stay close to the base scent's character, or deliberately contrast it.",
    min: 0,
    max: 100,
    step: 1,
    default: 50,
    minLabel: "Contrast",
    maxLabel: "Similar",
  },
  {
    id: "reach",
    label: "Reach",
    description: "Stick to well-known crowd-pleasers, or reach into niche and obscure picks.",
    min: 0,
    max: 100,
    step: 1,
    default: 50,
    minLabel: "Safe",
    maxLabel: "Adventurous",
  },
];

export function defaultParams(): IntelliScentParams {
  return Object.fromEntries(INTELLISCENT_PARAMS.map((p) => [p.id, p.default]));
}

/**
 * Coerces arbitrary input (saved settings, a request body) into a valid
 * params object for the *current* registry: unknown ids are dropped,
 * missing or non-numeric ones take their default, values are clamped.
 * This is what lets the registry change without breaking old saved data.
 */
export function normalizeParams(input: unknown): IntelliScentParams {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return Object.fromEntries(
    INTELLISCENT_PARAMS.map((def) => {
      const raw = source[def.id];
      const value = typeof raw === "number" && Number.isFinite(raw) ? raw : def.default;
      return [def.id, Math.min(def.max, Math.max(def.min, value))];
    })
  );
}

/** e.g. "Boldness 60 · Similarity 40 · Reach 50" - only params still in the registry. */
export function describeParams(params: IntelliScentParams): string {
  return INTELLISCENT_PARAMS.filter((def) => def.id in params)
    .map((def) => `${def.label} ${params[def.id]}`)
    .join(" · ");
}

/** A param's value scaled to 0..1 - the form algorithms want to work in. */
export function paramUnit(params: IntelliScentParams, id: string): number {
  const def = INTELLISCENT_PARAMS.find((p) => p.id === id);
  if (!def) return 0.5;
  const value = params[id] ?? def.default;
  return def.max === def.min ? 0.5 : (value - def.min) / (def.max - def.min);
}
