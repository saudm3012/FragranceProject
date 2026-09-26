// The affinity matrix M (framework: "Harmony: the affinity matrix"): how
// well two accord axes traditionally play together, -1 (they fight) to +1
// (a classic pairing). Symmetric; one line per pair below.
//
// PROVENANCE - read before trusting these numbers:
//   - Lines marked [doc] are the framework's own values, copied verbatim.
//   - Everything else is a DRAFT written from general perfumery convention
//     to fill the matrix, not perfumer-verified. The framework calls this
//     matrix "the most valuable asset the whole system produces"; it should
//     be reviewed by someone with a trained nose. Unlisted pairs are 0.
//   - Diagonal (same family twice) is mildly positive: families reinforce
//     themselves, but redundancy is the Interest term's job to discourage.

import { AXIS_IDS, type AxisId } from "@/lib/intelliscent/axes";

type Entry = [AxisId, AxisId, number];

const ENTRIES: Entry[] = [
  // --- diagonal ---
  ["citrus", "citrus", 0.5], ["green", "green", 0.5], ["aromatic", "aromatic", 0.5], ["aquatic", "aquatic", 0.4],
  ["whiteFloral", "whiteFloral", 0.4], ["rose", "rose", 0.5], ["powderyIris", "powderyIris", 0.5], ["fruity", "fruity", 0.4],
  ["gourmand", "gourmand", 0.4], ["warmSpice", "warmSpice", 0.4], ["freshSpice", "freshSpice", 0.5], ["dryWoods", "dryWoods", 0.6],
  ["creamyWoods", "creamyWoods", 0.6], ["amberResin", "amberResin", 0.5], ["musk", "musk", 0.7], ["leatherAnimalic", "leatherAnimalic", 0.4],
  ["smokeOud", "smokeOud", 0.3],

  // --- framework values [doc] ---
  ["citrus", "dryWoods", 0.8], // [doc] classic cologne structure
  ["amberResin", "gourmand", 0.9], // [doc] vanilla and amber share molecules
  ["rose", "smokeOud", 0.8], // [doc] Middle Eastern rose-oud
  ["aromatic", "gourmand", 0.7], // [doc] lavender-vanilla fougere-gourmand
  ["aquatic", "gourmand", -0.6], // [doc] marine + sugar read as confused
  ["fruity", "leatherAnimalic", -0.5], // [doc] fruit over animalic smells off
  ["green", "powderyIris", 0.6], // [doc] cool, restrained families

  // --- draft: citrus ---
  ["citrus", "green", 0.7], ["citrus", "aromatic", 0.8], ["citrus", "aquatic", 0.5], ["citrus", "whiteFloral", 0.3],
  ["citrus", "rose", 0.3], ["citrus", "powderyIris", 0.2], ["citrus", "fruity", 0.6], ["citrus", "gourmand", 0.2],
  ["citrus", "warmSpice", 0.2], ["citrus", "freshSpice", 0.7], ["citrus", "creamyWoods", 0.4], ["citrus", "amberResin", 0.3],
  ["citrus", "musk", 0.6], ["citrus", "leatherAnimalic", 0.1], ["citrus", "smokeOud", 0.1],
  // --- draft: green ---
  ["green", "aromatic", 0.7], ["green", "aquatic", 0.5], ["green", "whiteFloral", 0.3], ["green", "rose", 0.3],
  ["green", "fruity", 0.3], ["green", "gourmand", -0.3], ["green", "freshSpice", 0.5], ["green", "dryWoods", 0.6],
  ["green", "creamyWoods", 0.2], ["green", "amberResin", -0.1], ["green", "musk", 0.4], ["green", "leatherAnimalic", 0.2],
  // --- draft: aromatic ---
  ["aromatic", "aquatic", 0.5], ["aromatic", "rose", 0.2], ["aromatic", "powderyIris", 0.5], ["aromatic", "fruity", 0.1],
  ["aromatic", "warmSpice", 0.4], ["aromatic", "freshSpice", 0.6], ["aromatic", "dryWoods", 0.6], ["aromatic", "creamyWoods", 0.4],
  ["aromatic", "amberResin", 0.5], ["aromatic", "musk", 0.5], ["aromatic", "leatherAnimalic", 0.4], ["aromatic", "smokeOud", 0.2],
  // --- draft: aquatic ---
  ["aquatic", "rose", -0.1], ["aquatic", "powderyIris", -0.1], ["aquatic", "fruity", 0.2], ["aquatic", "warmSpice", -0.3],
  ["aquatic", "freshSpice", 0.4], ["aquatic", "dryWoods", 0.4], ["aquatic", "amberResin", 0.2], ["aquatic", "musk", 0.4],
  ["aquatic", "leatherAnimalic", -0.3], ["aquatic", "smokeOud", -0.4],
  // --- draft: white floral ---
  ["whiteFloral", "rose", 0.6], ["whiteFloral", "powderyIris", 0.5], ["whiteFloral", "fruity", 0.4], ["whiteFloral", "gourmand", 0.5],
  ["whiteFloral", "warmSpice", 0.2], ["whiteFloral", "freshSpice", 0.1], ["whiteFloral", "dryWoods", 0.2], ["whiteFloral", "creamyWoods", 0.7],
  ["whiteFloral", "amberResin", 0.5], ["whiteFloral", "musk", 0.6], ["whiteFloral", "leatherAnimalic", 0.1], ["whiteFloral", "smokeOud", 0.1],
  // --- draft: rose ---
  ["rose", "powderyIris", 0.6], ["rose", "fruity", 0.5], ["rose", "gourmand", 0.3], ["rose", "warmSpice", 0.5],
  ["rose", "freshSpice", 0.4], ["rose", "dryWoods", 0.4], ["rose", "creamyWoods", 0.5], ["rose", "amberResin", 0.6],
  ["rose", "musk", 0.6], ["rose", "leatherAnimalic", 0.4],
  // --- draft: powdery / iris ---
  ["powderyIris", "fruity", 0.1], ["powderyIris", "gourmand", 0.5], ["powderyIris", "warmSpice", 0.1], ["powderyIris", "freshSpice", 0.1],
  ["powderyIris", "dryWoods", 0.3], ["powderyIris", "creamyWoods", 0.6], ["powderyIris", "amberResin", 0.4], ["powderyIris", "musk", 0.8],
  ["powderyIris", "leatherAnimalic", 0.6], ["powderyIris", "smokeOud", 0.1],
  // --- draft: fruity ---
  ["fruity", "gourmand", 0.5], ["fruity", "warmSpice", 0.2], ["fruity", "freshSpice", 0.2], ["fruity", "dryWoods", 0.2],
  ["fruity", "creamyWoods", 0.3], ["fruity", "amberResin", 0.3], ["fruity", "musk", 0.5], ["fruity", "smokeOud", -0.2],
  // --- draft: gourmand ---
  ["gourmand", "warmSpice", 0.6], ["gourmand", "dryWoods", 0.2], ["gourmand", "creamyWoods", 0.6], ["gourmand", "musk", 0.5],
  ["gourmand", "smokeOud", 0.5],
  // --- draft: spices ---
  ["warmSpice", "freshSpice", 0.3], ["warmSpice", "dryWoods", 0.5], ["warmSpice", "creamyWoods", 0.5], ["warmSpice", "amberResin", 0.8],
  ["warmSpice", "musk", 0.3], ["warmSpice", "leatherAnimalic", 0.6], ["warmSpice", "smokeOud", 0.6],
  ["freshSpice", "dryWoods", 0.6], ["freshSpice", "creamyWoods", 0.3], ["freshSpice", "amberResin", 0.3], ["freshSpice", "musk", 0.4],
  ["freshSpice", "leatherAnimalic", 0.3], ["freshSpice", "smokeOud", 0.3],
  // --- draft: woods, resins, base ---
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

export const DEFAULT_AFFINITY: AffinityMatrix = (() => {
  const m: AffinityMatrix = {};
  for (const [a, b, v] of ENTRIES) {
    const key = cellKey(a, b);
    if (key in m) throw new Error(`Duplicate affinity entry ${key}`);
    m[key] = v;
  }
  return m;
})();

export function affinity(matrix: AffinityMatrix, a: AxisId, b: AxisId): number {
  return matrix[cellKey(a, b)] ?? 0;
}
