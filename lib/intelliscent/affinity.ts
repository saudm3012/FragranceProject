// The affinity matrix M (framework: "Harmony: the affinity matrix"): how
// well two accord axes traditionally play together, -1 (they fight) to +1
// (a classic pairing). Symmetric; one line per pair below, in three tiers:
//
//   DOC       The framework's own values, verbatim. Used at full strength.
//   REVIEWED  Values confirmed by a nose (the product owner's review so
//             far). Used at full strength. Bench-tested cells move here.
//   DRAFT     Filled in from general perfumery convention, NOT verified.
//             Pulled toward neutral (x DRAFT_CONFIDENCE) so an unverified
//             guess can't over- or under-penalize a family; personal
//             feedback (Layer 1, later Layer 2) fills them in from real
//             wear. Bench-test the most-used ones first -
//             `npm run affinity:usage` ranks cells by how much of the
//             stored fragrances' pairings they actually carry.
//
// The diagonal (same family twice) is deliberately near-neutral (+0.1):
// redundancy is the Interest term's job; rewarding it here too would push
// "more of the same" combos above complementary ones. Unlisted pairs are 0.

import { AXIS_IDS, type AxisId } from "@/lib/intelliscent/axes";

type Entry = [AxisId, AxisId, number];
export type AffinityTier = "doc" | "reviewed" | "draft";

/** How much weight an unverified draft value gets (0 = neutral, 1 = as written). */
export const DRAFT_CONFIDENCE = 0.5;

const DIAGONAL = 0.1;

const DOC: Entry[] = [
  ["citrus", "dryWoods", 0.8], // classic cologne structure
  ["amberResin", "gourmand", 0.9], // vanilla and amber share molecules
  ["rose", "smokeOud", 0.8], // Middle Eastern rose-oud
  ["aromatic", "gourmand", 0.7], // lavender-vanilla fougere-gourmand
  ["aquatic", "gourmand", -0.6], // marine + sugar read as confused
  ["fruity", "leatherAnimalic", -0.5], // fruit over animalic smells off
  ["green", "powderyIris", 0.6], // cool, restrained families
];

const REVIEWED: Entry[] = [
  ...AXIS_IDS.map((id): Entry => [id, id, DIAGONAL]),
  ["aquatic", "smokeOud", -0.4], // marine freshness genuinely fights smoky oud ("dousing a campfire")
  ["green", "gourmand", -0.15], // unnatural but no hard clash - fig-vanilla, pistachio gourmands, galbanum-praline work
];

const DRAFT: Entry[] = [
  // --- citrus ---
  ["citrus", "green", 0.7], ["citrus", "aromatic", 0.8], ["citrus", "aquatic", 0.5], ["citrus", "whiteFloral", 0.3],
  ["citrus", "rose", 0.3], ["citrus", "powderyIris", 0.2], ["citrus", "fruity", 0.6], ["citrus", "gourmand", 0.2],
  ["citrus", "warmSpice", 0.2], ["citrus", "freshSpice", 0.7], ["citrus", "creamyWoods", 0.4], ["citrus", "amberResin", 0.3],
  ["citrus", "musk", 0.6], ["citrus", "leatherAnimalic", 0.1], ["citrus", "smokeOud", 0.1],
  // --- green ---
  ["green", "aromatic", 0.7], ["green", "aquatic", 0.5], ["green", "whiteFloral", 0.3], ["green", "rose", 0.3],
  ["green", "fruity", 0.3], ["green", "freshSpice", 0.5], ["green", "dryWoods", 0.6],
  ["green", "creamyWoods", 0.2], ["green", "amberResin", -0.1], ["green", "musk", 0.4], ["green", "leatherAnimalic", 0.2],
  // --- aromatic ---
  ["aromatic", "aquatic", 0.5], ["aromatic", "rose", 0.2], ["aromatic", "powderyIris", 0.5], ["aromatic", "fruity", 0.1],
  ["aromatic", "warmSpice", 0.4], ["aromatic", "freshSpice", 0.6], ["aromatic", "dryWoods", 0.6], ["aromatic", "creamyWoods", 0.4],
  ["aromatic", "amberResin", 0.5], ["aromatic", "musk", 0.5], ["aromatic", "leatherAnimalic", 0.4], ["aromatic", "smokeOud", 0.2],
  // --- aquatic ---
  ["aquatic", "rose", -0.1], ["aquatic", "powderyIris", -0.1], ["aquatic", "fruity", 0.2], ["aquatic", "warmSpice", -0.3],
  ["aquatic", "freshSpice", 0.4], ["aquatic", "dryWoods", 0.4], ["aquatic", "amberResin", 0.2], ["aquatic", "musk", 0.4],
  ["aquatic", "leatherAnimalic", -0.3],
  // --- white floral ---
  ["whiteFloral", "rose", 0.6], ["whiteFloral", "powderyIris", 0.5], ["whiteFloral", "fruity", 0.4], ["whiteFloral", "gourmand", 0.5],
  ["whiteFloral", "warmSpice", 0.2], ["whiteFloral", "freshSpice", 0.1], ["whiteFloral", "dryWoods", 0.2], ["whiteFloral", "creamyWoods", 0.7],
  ["whiteFloral", "amberResin", 0.5], ["whiteFloral", "musk", 0.6], ["whiteFloral", "leatherAnimalic", 0.1], ["whiteFloral", "smokeOud", 0.1],
  // --- rose ---
  ["rose", "powderyIris", 0.6], ["rose", "fruity", 0.5], ["rose", "gourmand", 0.3], ["rose", "warmSpice", 0.5],
  ["rose", "freshSpice", 0.4], ["rose", "dryWoods", 0.4], ["rose", "creamyWoods", 0.5], ["rose", "amberResin", 0.6],
  ["rose", "musk", 0.6], ["rose", "leatherAnimalic", 0.4],
  // --- powdery / iris ---
  ["powderyIris", "fruity", 0.1], ["powderyIris", "gourmand", 0.5], ["powderyIris", "warmSpice", 0.1], ["powderyIris", "freshSpice", 0.1],
  ["powderyIris", "dryWoods", 0.3], ["powderyIris", "creamyWoods", 0.6], ["powderyIris", "amberResin", 0.4], ["powderyIris", "musk", 0.8],
  ["powderyIris", "leatherAnimalic", 0.6], ["powderyIris", "smokeOud", 0.1],
  // --- fruity ---
  ["fruity", "gourmand", 0.5], ["fruity", "warmSpice", 0.2], ["fruity", "freshSpice", 0.2], ["fruity", "dryWoods", 0.2],
  ["fruity", "creamyWoods", 0.3], ["fruity", "amberResin", 0.3], ["fruity", "musk", 0.5], ["fruity", "smokeOud", -0.2],
  // --- gourmand ---
  ["gourmand", "warmSpice", 0.6], ["gourmand", "dryWoods", 0.2], ["gourmand", "creamyWoods", 0.6], ["gourmand", "musk", 0.5],
  ["gourmand", "smokeOud", 0.5],
  // --- spices ---
  ["warmSpice", "freshSpice", 0.3], ["warmSpice", "dryWoods", 0.5], ["warmSpice", "creamyWoods", 0.5], ["warmSpice", "amberResin", 0.8],
  ["warmSpice", "musk", 0.3], ["warmSpice", "leatherAnimalic", 0.6], ["warmSpice", "smokeOud", 0.6],
  ["freshSpice", "dryWoods", 0.6], ["freshSpice", "creamyWoods", 0.3], ["freshSpice", "amberResin", 0.3], ["freshSpice", "musk", 0.4],
  ["freshSpice", "leatherAnimalic", 0.3], ["freshSpice", "smokeOud", 0.3],
  // --- woods, resins, base ---
  ["dryWoods", "creamyWoods", 0.6], ["dryWoods", "amberResin", 0.6], ["dryWoods", "musk", 0.5], ["dryWoods", "leatherAnimalic", 0.6],
  ["dryWoods", "smokeOud", 0.7], ["creamyWoods", "amberResin", 0.7], ["creamyWoods", "musk", 0.7], ["creamyWoods", "leatherAnimalic", 0.4],
  ["creamyWoods", "smokeOud", 0.5], ["amberResin", "musk", 0.6], ["amberResin", "leatherAnimalic", 0.6], ["amberResin", "smokeOud", 0.7],
  ["musk", "leatherAnimalic", 0.4], ["musk", "smokeOud", 0.2], ["leatherAnimalic", "smokeOud", 0.7],
];

/** Order-independent key for a matrix cell, e.g. "citrus|dryWoods". */
export function cellKey(a: AxisId, b: AxisId): string {
  return AXIS_IDS.indexOf(a) <= AXIS_IDS.indexOf(b) ? `${a}|${b}` : `${b}|${a}`;
}

export type AffinityMatrix = Record<string, number>; // cellKey -> value

/** Where each cell's value came from - used by the usage report to show what still needs a nose. */
export const AFFINITY_TIER: Record<string, AffinityTier> = {};

export const DEFAULT_AFFINITY: AffinityMatrix = (() => {
  const m: AffinityMatrix = {};
  const tiers: Array<[AffinityTier, Entry[], number]> = [
    ["doc", DOC, 1],
    ["reviewed", REVIEWED, 1],
    ["draft", DRAFT, DRAFT_CONFIDENCE],
  ];
  for (const [tier, entries, weight] of tiers) {
    for (const [a, b, v] of entries) {
      const key = cellKey(a, b);
      if (key in m) throw new Error(`Affinity cell ${key} is listed twice (${AFFINITY_TIER[key]} and ${tier})`);
      m[key] = Math.round(v * weight * 1000) / 1000;
      AFFINITY_TIER[key] = tier;
    }
  }
  return m;
})();

export function affinity(matrix: AffinityMatrix, a: AxisId, b: AxisId): number {
  return matrix[cellKey(a, b)] ?? 0;
}
