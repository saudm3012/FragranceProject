// Translation tables from Fragrantica's data to the framework's profile.
// Fragrantica has ~70 free-form accords; the framework has 17 fixed axes.
// Each Fragrantica accord spreads over one or more axes (weights sum to 1).
// A few accords mean different things on different fragrances; those are
// CONTEXTUAL_ACCORDS below, resolved from the fragrance's own notes.
// Accords not listed anywhere are ignored and reported as unmapped.

import type { AxisId } from "@/lib/intelliscent/axes";
import type { MoleculeId } from "@/lib/intelliscent/profile";

type AxisWeights = Partial<Record<AxisId, number>>;

export const ACCORD_TO_AXES: Record<string, AxisWeights> = {
  // citrus
  citrus: { citrus: 1 },
  sour: { citrus: 0.5, fruity: 0.5 },
  // green / aromatic
  green: { green: 1 },
  herbal: { aromatic: 0.6, green: 0.4 },
  aromatic: { aromatic: 1 },
  lavender: { aromatic: 1 },
  camphor: { aromatic: 0.7, green: 0.3 },
  anis: { freshSpice: 0.6, aromatic: 0.4 },
  conifer: { green: 0.5, dryWoods: 0.5 },
  terpenic: { green: 0.5, citrus: 0.2, dryWoods: 0.3 },
  bitter: { green: 0.6, dryWoods: 0.4 },
  mossy: { green: 0.45, dryWoods: 0.4, leatherAnimalic: 0.15 }, // oakmoss carries a faint animalic edge
  earthy: { dryWoods: 0.6, green: 0.4 },
  // aquatic
  aquatic: { aquatic: 1 },
  marine: { aquatic: 1 },
  ozonic: { aquatic: 0.8, green: 0.2 },
  salty: { aquatic: 0.6, amberResin: 0.4 },
  mineral: { aquatic: 0.5, dryWoods: 0.5 },
  metallic: { aquatic: 0.5, freshSpice: 0.5 },
  // florals
  floral: { whiteFloral: 0.5, rose: 0.5 },
  "white floral": { whiteFloral: 1 },
  "yellow floral": { whiteFloral: 1 },
  tuberose: { whiteFloral: 1 },
  rose: { rose: 1 },
  iris: { powderyIris: 1 },
  violet: { powderyIris: 0.7, green: 0.3 },
  powdery: { powderyIris: 1 },
  aldehydic: { powderyIris: 0.5, citrus: 0.5 },
  soapy: { musk: 0.5, powderyIris: 0.5 },
  // fruity
  fruity: { fruity: 1 },
  tropical: { fruity: 1 },
  cherry: { fruity: 0.7, gourmand: 0.3 },
  // gourmand
  sweet: { gourmand: 1 },
  vanilla: { gourmand: 1 },
  caramel: { gourmand: 1 },
  chocolate: { gourmand: 1 },
  cacao: { gourmand: 1 },
  almond: { gourmand: 1 },
  nutty: { gourmand: 1 },
  honey: { gourmand: 0.7, amberResin: 0.3 },
  coffee: { gourmand: 0.7, smokeOud: 0.3 },
  coconut: { gourmand: 0.6, creamyWoods: 0.4 },
  lactonic: { gourmand: 0.6, creamyWoods: 0.4 },
  beeswax: { gourmand: 0.5, amberResin: 0.5 },
  rum: { gourmand: 0.5, warmSpice: 0.3, amberResin: 0.2 },
  whiskey: { gourmand: 0.5, warmSpice: 0.3, amberResin: 0.2 },
  alcohol: { gourmand: 0.5, warmSpice: 0.3, amberResin: 0.2 },
  wine: { gourmand: 0.4, fruity: 0.4, warmSpice: 0.2 },
  // spices
  "warm spicy": { warmSpice: 1 },
  cinnamon: { warmSpice: 1 },
  "fresh spicy": { freshSpice: 1 },
  "soft spicy": { warmSpice: 0.6, freshSpice: 0.4 },
  savory: { warmSpice: 0.5, green: 0.5 },
  // woods / resins / base
  patchouli: { dryWoods: 0.7, amberResin: 0.3 },
  amber: { amberResin: 1 },
  balsamic: { amberResin: 1 },
  musky: { musk: 1 },
  leather: { leatherAnimalic: 1 },
  animalic: { leatherAnimalic: 1 },
  smoky: { smokeOud: 1 },
  oud: { smokeOud: 1 },
};

// --- Accords resolved per fragrance ------------------------------------------
// `notes` is the fragrance's whole note list, lowercased.

const hits = (notes: string[], keywords: string[]) =>
  notes.filter((n) => keywords.some((k) => n.includes(k))).length;

/**
 * Splits weight across families in proportion to note evidence, with a
 * small prior so a family with no evidence still gets a little. With no
 * evidence at all, the split is even.
 */
function leanByNotes(notes: string[], families: Array<[AxisId, string[]]>, prior = 0.5): AxisWeights {
  const scores = families.map(([axisId, keywords]) => [axisId, prior + hits(notes, keywords)] as const);
  const total = scores.reduce((sum, [, s]) => sum + s, 0);
  return Object.fromEntries(scores.map(([axisId, s]) => [axisId, s / total]));
}

const CREAMY_WOOD_NOTES = ["sandalwood", "cashmere", "cashmeran", "guaiac", "coconut", "tonka", "cream"];
const DRY_WOOD_NOTES = ["cedar", "vetiver", "cypress", "birch", "pine", "papyrus", "hinoki", "oakmoss", "fir", "juniper"];
const SMOKED_TOBACCO_NOTES = ["birch tar", "tar", "cade", "smoke", "smoky", "burnt", "incense"];

export const CONTEXTUAL_ACCORDS: Record<string, (notes: string[]) => AxisWeights> = {
  // Fragrantica has one "woody"; the framework splits dry (cedar, vetiver) from creamy (sandalwood).
  woody: (notes) =>
    hits(notes, CREAMY_WOOD_NOTES) + hits(notes, DRY_WOOD_NOTES) === 0
      ? { dryWoods: 0.65, creamyWoods: 0.35 }
      : leanByNotes(notes, [["dryWoods", DRY_WOOD_NOTES], ["creamyWoods", CREAMY_WOOD_NOTES]], 0),
  // "Fresh" is used too loosely to split evenly - lean toward what the notes actually show.
  fresh: (notes) =>
    leanByNotes(notes, [
      ["citrus", ["bergamot", "lemon", "lime", "grapefruit", "mandarin", "orange", "citrus", "yuzu", "petitgrain"]],
      ["aquatic", ["sea", "marine", "water", "calone", "ozon", "salt", "aquatic", "rain"]],
      ["green", ["grass", "violet leaf", "green", "leaf", "galbanum", "mint", "tea", "cucumber"]],
    ]),
  // Straight tobacco is honeyed and hay-like (more Chergui than campfire); only smoked styles lead with smoke.
  tobacco: (notes) =>
    hits(notes, SMOKED_TOBACCO_NOTES) > 0
      ? { smokeOud: 0.5, gourmand: 0.25, warmSpice: 0.25 }
      : { gourmand: 0.5, warmSpice: 0.3, smokeOud: 0.2 },
};

/** Every accord name IntelliScent understands - what a custom fragrance can be described with. */
export const KNOWN_ACCORDS: readonly string[] = [
  ...new Set([...Object.keys(ACCORD_TO_AXES), ...Object.keys(CONTEXTUAL_ACCORDS)]),
].sort();

/**
 * Direct sweetness signal per Fragrantica accord (0..1). Community-voted
 * "sweet"/"vanilla"/"caramel" accords are a better sweetness read than the
 * axis blend alone, since several axes mix sweet and non-sweet members.
 */
export const ACCORD_SWEETNESS: Record<string, number> = {
  sweet: 1, caramel: 1, honey: 0.9, vanilla: 0.85, chocolate: 0.8, cacao: 0.7, cherry: 0.7,
  tropical: 0.6, almond: 0.6, fruity: 0.5, coconut: 0.5, beeswax: 0.5, rum: 0.5, lactonic: 0.4,
  amber: 0.35, balsamic: 0.3, tobacco: 0.3, coffee: 0.3, powdery: 0.2, "white floral": 0.2,
};

/**
 * Loud-molecule detection. Brands often omit these from note lists, so
 * this under-detects - a known limit of profiling from marketing pyramids.
 * `notes`: note-name fragments that signal the material (with confidence);
 * `accords`: a Fragrantica accord at or above `minStrength` implies it more weakly.
 */
export const MOLECULE_SIGNALS: Record<
  MoleculeId,
  { notes: Array<[string, number]>; accords?: Array<{ name: string; minStrength: number; value: number }> }
> = {
  ambroxan: { notes: [["ambroxan", 1], ["ambrox", 1], ["ambergris", 0.6]] },
  isoESuper: { notes: [["iso e super", 1]] },
  ethylMaltol: { notes: [["ethyl maltol", 1], ["cotton candy", 0.8], ["candy floss", 0.8]], accords: [{ name: "caramel", minStrength: 60, value: 0.5 }] },
  calone: { notes: [["calone", 1], ["sea notes", 0.6], ["marine notes", 0.6], ["watery notes", 0.5]], accords: [{ name: "marine", minStrength: 60, value: 0.5 }] },
  cashmeran: { notes: [["cashmeran", 1], ["cashmere wood", 0.8], ["cashmere musk", 0.6]] },
  aldehydes: { notes: [["aldehydes", 1]], accords: [{ name: "aldehydic", minStrength: 40, value: 0.7 }] },
};

/** Fragrantica vote option -> numeric level, for averaging community votes. */
export const LONGEVITY_LEVELS: Record<string, number> = {
  "very weak": 1,
  weak: 2,
  moderate: 3,
  "long lasting": 4,
  eternal: 5,
};
export const SILLAGE_LEVELS: Record<string, number> = {
  intimate: 1,
  moderate: 2.33,
  strong: 3.67,
  enormous: 5,
};
