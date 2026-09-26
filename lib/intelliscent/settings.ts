// Every tunable number in the layering framework ("Customizable
// parameters"), plus the active context filter. Defaults are the
// framework's own values; where it gives none, the default is ours and
// marked (ours). The UI is generated from SETTINGS_GROUPS at the bottom -
// add or remove a control there and the settings panel follows.

import { MOLECULES, OCCASIONS, SEASONS, TIMES_OF_DAY, type MoleculeId, type Occasion, type Season, type TimeOfDay } from "@/lib/intelliscent/profile";

export interface IntelliScentSettings {
  weights: { harmony: number; structure: number; interest: number; context: number };
  interestCenter: number; // Goldilocks peak, cosine distance
  interestWidth: number; // the curve's 2*variance denominator term (framework calls it "width")
  sweetnessCap: number; // combined sweetness cap for a pair
  sweetnessCapPerExtraScent: number; // cap grows by this per scent beyond 2 (framework: ~0.3)
  strengthMismatchThreshold: number; // on the 1-5 strength scale
  moleculeFlags: MoleculeId[]; // which loud molecules count toward the clash penalty
  minScore: number; // 0-1; results below this are hidden
  extendBars: { pair: number; triple: number }; // greedy extension bars (framework: 0.6, 0.75)
  maxComboSize: 3 | 4; // framework: cap at 3, 4 only as an experimental mode
  // 3+ scents: the anchor is relative to its combo - the most base-heavy
  // member only counts as an anchor if its late weight beats the runner-up
  // by at least this margin (0-0.5 scale). Otherwise there's no real anchor.
  anchorMargin: number;
  accentMaxStrength: number; // 1-5; accents are "a whisper, not a third anchor"
  sprayMultiplier: number; // scales every recipe's spray counts (personalization nudges it for "faded fast")
  context: { seasons: Season[]; occasions: Occasion[]; timeOfDay: TimeOfDay[] }; // empty = no filter
}

export const DEFAULT_SETTINGS: IntelliScentSettings = {
  weights: { harmony: 0.35, structure: 0.25, interest: 0.2, context: 0.2 },
  interestCenter: 0.45,
  interestWidth: 0.02,
  sweetnessCap: 1.2,
  sweetnessCapPerExtraScent: 0.3,
  strengthMismatchThreshold: 2,
  moleculeFlags: MOLECULES.map((m) => m.id),
  minScore: 0.4,
  extendBars: { pair: 0.6, triple: 0.75 },
  maxComboSize: 3,
  anchorMargin: 0.05,
  accentMaxStrength: 2.5,
  sprayMultiplier: 1,
  context: { seasons: [], occasions: [], timeOfDay: [] },
};

// --- normalization ---------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function num(v: unknown, fallback: number, lo: number, hi: number): number {
  return typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
}

function subset<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  return Array.isArray(v) ? allowed.filter((x) => v.includes(x)) : [];
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** Coerces untrusted input (request bodies, saved settings) into valid settings, filling gaps with defaults. */
export function normalizeSettings(input: unknown): IntelliScentSettings {
  const s = obj(input);
  const d = DEFAULT_SETTINGS;
  const w = obj(s.weights);
  const bars = obj(s.extendBars);
  const ctx = obj(s.context);
  return {
    weights: {
      harmony: num(w.harmony, d.weights.harmony, 0, 1),
      structure: num(w.structure, d.weights.structure, 0, 1),
      interest: num(w.interest, d.weights.interest, 0, 1),
      context: num(w.context, d.weights.context, 0, 1),
    },
    interestCenter: num(s.interestCenter, d.interestCenter, 0, 1),
    interestWidth: num(s.interestWidth, d.interestWidth, 0.002, 0.5),
    sweetnessCap: num(s.sweetnessCap, d.sweetnessCap, 0.2, 3),
    sweetnessCapPerExtraScent: num(s.sweetnessCapPerExtraScent, d.sweetnessCapPerExtraScent, 0, 1),
    strengthMismatchThreshold: num(s.strengthMismatchThreshold, d.strengthMismatchThreshold, 0.5, 4),
    moleculeFlags: Array.isArray(s.moleculeFlags) ? subset(s.moleculeFlags, MOLECULES.map((m) => m.id)) : d.moleculeFlags,
    minScore: num(s.minScore, d.minScore, 0, 1),
    extendBars: {
      pair: num(bars.pair, d.extendBars.pair, 0, 1),
      triple: num(bars.triple, d.extendBars.triple, 0, 1),
    },
    maxComboSize: s.maxComboSize === 4 ? 4 : 3,
    anchorMargin: num(s.anchorMargin, d.anchorMargin, 0, 0.5),
    accentMaxStrength: num(s.accentMaxStrength, d.accentMaxStrength, 1, 5),
    sprayMultiplier: num(s.sprayMultiplier, d.sprayMultiplier, 0.5, 2),
    context: {
      seasons: subset(ctx.seasons, SEASONS),
      occasions: subset(ctx.occasions, OCCASIONS.map((o) => o.id)),
      timeOfDay: subset(ctx.timeOfDay, TIMES_OF_DAY),
    },
  };
}

// --- the "safe <-> adventurous" vibe ----------------------------------------
// The framework: Interest curve center + Harmony weight "together are
// effectively a single safe <-> adventurous slider". 0 = safest, 1 = most
// adventurous; the midpoint reproduces the framework defaults exactly.

export function vibeOf(s: IntelliScentSettings): number {
  return Math.round(clamp((s.interestCenter - 0.3) / 0.3, 0, 1) * 1000) / 1000;
}

export function withVibe(s: IntelliScentSettings, vibe: number): IntelliScentSettings {
  const v = clamp(vibe, 0, 1);
  return {
    ...s,
    interestCenter: Math.round((0.3 + 0.3 * v) * 1000) / 1000,
    weights: { ...s.weights, harmony: Math.round((0.45 - 0.2 * v) * 1000) / 1000 },
  };
}

// --- UI registry ------------------------------------------------------------

type Getter<T> = (s: IntelliScentSettings) => T;
type Setter<T> = (s: IntelliScentSettings, value: T) => IntelliScentSettings;

export type SettingControl =
  | {
      kind: "slider";
      id: string;
      label: string;
      description: string;
      min: number;
      max: number;
      step: number;
      minLabel?: string;
      maxLabel?: string;
      format?: (v: number) => string;
      get: Getter<number>;
      set: Setter<number>;
    }
  | {
      kind: "multiselect";
      id: string;
      label: string;
      description: string;
      options: ReadonlyArray<{ value: string; label: string }>;
      get: Getter<string[]>;
      set: Setter<string[]>;
    }
  | {
      kind: "toggle";
      id: string;
      label: string;
      description: string;
      get: Getter<boolean>;
      set: Setter<boolean>;
    };

export interface SettingsGroup {
  id: string;
  title: string;
  description?: string;
  collapsedByDefault?: boolean;
  controls: SettingControl[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fixed = (digits: number) => (v: number) => v.toFixed(digits);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function weightSlider(key: keyof IntelliScentSettings["weights"], label: string, description: string): SettingControl {
  return {
    kind: "slider",
    id: `weight-${key}`,
    label: `${label} weight`,
    description,
    min: 0,
    max: 1,
    step: 0.05,
    format: fixed(2),
    get: (s) => s.weights[key],
    set: (s, v) => ({ ...s, weights: { ...s.weights, [key]: v } }),
  };
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: "vibe",
    title: "Vibe",
    controls: [
      {
        kind: "slider",
        id: "vibe",
        label: "Safe ↔ Adventurous",
        description: "Moves the interest sweet spot and the harmony weight together.",
        min: 0,
        max: 1,
        step: 0.05,
        minLabel: "Safe",
        maxLabel: "Adventurous",
        format: pct,
        get: vibeOf,
        set: withVibe,
      },
    ],
  },
  {
    id: "context",
    title: "Context",
    description: "Leave empty to ignore context entirely.",
    controls: [
      {
        kind: "multiselect",
        id: "context-seasons",
        label: "Season",
        description: "",
        options: SEASONS.map((s) => ({ value: s, label: cap(s) })),
        get: (s) => s.context.seasons,
        set: (s, v) => ({ ...s, context: { ...s.context, seasons: v as Season[] } }),
      },
      {
        kind: "multiselect",
        id: "context-time",
        label: "Time of day",
        description: "",
        options: TIMES_OF_DAY.map((t) => ({ value: t, label: cap(t) })),
        get: (s) => s.context.timeOfDay,
        set: (s, v) => ({ ...s, context: { ...s.context, timeOfDay: v as TimeOfDay[] } }),
      },
      {
        kind: "multiselect",
        id: "context-occasions",
        label: "Occasion (estimated)",
        description: "Occasion fit is a low-confidence estimate - Fragrantica has no occasion votes. Your wear check-ins in My Combos correct it.",
        options: OCCASIONS.map((o) => ({ value: o.id, label: o.label })),
        get: (s) => s.context.occasions,
        set: (s, v) => ({ ...s, context: { ...s.context, occasions: v as Occasion[] } }),
      },
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    description: "Every number in the framework, exposed. Weights are relative - they don't need to sum to 1.",
    collapsedByDefault: true,
    controls: [
      weightSlider("harmony", "Harmony", "Up: safer, conventionally correct pairings. Down: more experimental, more clash risk."),
      weightSlider("structure", "Structure", "Up: stronger preference for clear anchor/modifier pairs."),
      weightSlider("interest", "Interest", "Up: bolder, more distinct combos. Down: closer, reinforcing ones."),
      weightSlider("context", "Context", "Up: stay tightly inside the context filter. Down: favor pure scent chemistry."),
      {
        kind: "slider",
        id: "interest-center",
        label: "Interest sweet spot",
        description: "Cosine distance that counts as most interesting. Higher favors contrast.",
        min: 0.1,
        max: 0.9,
        step: 0.05,
        format: fixed(2),
        get: (s) => s.interestCenter,
        set: (s, v) => ({ ...s, interestCenter: v }),
      },
      {
        kind: "slider",
        id: "interest-width",
        label: "Interest curve width",
        description: "Wider accepts more variety as interesting; narrower is stricter.",
        min: 0.005,
        max: 0.1,
        step: 0.005,
        format: fixed(3),
        get: (s) => s.interestWidth,
        set: (s, v) => ({ ...s, interestWidth: v }),
      },
      {
        kind: "slider",
        id: "sweetness-cap",
        label: "Sweetness cap",
        description: "Combined sweetness allowed before a combo is penalized as cloying (for pairs; grows per extra scent).",
        min: 0.4,
        max: 2,
        step: 0.05,
        format: fixed(2),
        get: (s) => s.sweetnessCap,
        set: (s, v) => ({ ...s, sweetnessCap: v }),
      },
      {
        kind: "slider",
        id: "strength-threshold",
        label: "Strength mismatch threshold",
        description: "Largest strength gap (1-5 scale) allowed between anchor and modifier before a penalty.",
        min: 0.5,
        max: 4,
        step: 0.25,
        format: fixed(2),
        get: (s) => s.strengthMismatchThreshold,
        set: (s, v) => ({ ...s, strengthMismatchThreshold: v }),
      },
      {
        kind: "multiselect",
        id: "molecules",
        label: "Loud molecules to check",
        description: "Doubling any of these across scents is penalized. Trim for vintage-heavy collections.",
        options: MOLECULES.map((m) => ({ value: m.id, label: m.label })),
        get: (s) => s.moleculeFlags,
        set: (s, v) => ({ ...s, moleculeFlags: v as MoleculeId[] }),
      },
      {
        kind: "slider",
        id: "min-score",
        label: "Minimum score",
        description: "Hide suggestions below this score. Bands: Excellent 55+, Good 45-55, Worth trying 35-45 (lower it to 35 to see that whole band).",
        min: 0,
        max: 0.9,
        step: 0.05,
        format: pct,
        get: (s) => s.minScore,
        set: (s, v) => ({ ...s, minScore: v }),
      },
      {
        kind: "slider",
        id: "extend-pair",
        label: "Pair → triple bar",
        description: "A pair must score above this to have a third scent suggested.",
        min: 0.3,
        max: 0.95,
        step: 0.05,
        format: pct,
        get: (s) => s.extendBars.pair,
        set: (s, v) => ({ ...s, extendBars: { ...s.extendBars, pair: v } }),
      },
      {
        kind: "slider",
        id: "extend-triple",
        label: "Triple → four bar",
        description: "A triple must score above this to be extended again (experimental mode only).",
        min: 0.3,
        max: 0.95,
        step: 0.05,
        format: pct,
        get: (s) => s.extendBars.triple,
        set: (s, v) => ({ ...s, extendBars: { ...s.extendBars, triple: v } }),
      },
      {
        kind: "slider",
        id: "accent-strength",
        label: "Max accent strength",
        description: "Accents in 3+ scent combos must be at most this strong (1-5).",
        min: 1,
        max: 5,
        step: 0.25,
        format: fixed(2),
        get: (s) => s.accentMaxStrength,
        set: (s, v) => ({ ...s, accentMaxStrength: v }),
      },
      {
        kind: "slider",
        id: "anchor-margin",
        label: "Anchor margin (late weight)",
        description: "In 3+ scent combos, the most base-heavy scent must out-last the runner-up by this much to count as the anchor.",
        min: 0,
        max: 0.2,
        step: 0.01,
        format: fixed(2),
        get: (s) => s.anchorMargin,
        set: (s, v) => ({ ...s, anchorMargin: v }),
      },
      {
        kind: "slider",
        id: "spray-multiplier",
        label: "Spray multiplier",
        description: "Scales every recipe's spray counts (still capped at 4 per scent).",
        min: 0.5,
        max: 2,
        step: 0.1,
        format: (v) => `${v.toFixed(1)}×`,
        get: (s) => s.sprayMultiplier,
        set: (s, v) => ({ ...s, sprayMultiplier: v }),
      },
      {
        kind: "toggle",
        id: "experimental-four",
        label: "Experimental: allow 4-scent combos",
        description: "Working perfumers rarely stack more than three; four is off by default.",
        get: (s) => s.maxComboSize === 4,
        set: (s, v) => ({ ...s, maxComboSize: v ? 4 : 3 }),
      },
    ],
  },
];
