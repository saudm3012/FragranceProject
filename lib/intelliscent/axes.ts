// The 17 accord axes from the layering framework (Docs/Fragrance Layering
// Algorithm), plus per-axis properties the profile estimator and blend
// descriptions rely on. Everything axis-specific lives in this one table -
// adjust a number here and it flows through estimation, scoring and copy.
//
// The per-axis numbers (half-life, warmth, sweetness, loudness) are
// perfumery-convention estimates used ONLY to estimate profiles from
// Fragrantica data; hand-entered profile overrides bypass them entirely.

export interface AxisDef {
  id: string;
  label: string;
  adjective: string; // for blend descriptions: "smoky vanilla"
  noun: string; // for blend descriptions: "warm tobacco", "a citrus opening" - keep single-word-ish, they get joined with "and"
  halfLifeHours: number; // how fast this family fades on skin (estimation only)
  warmth: number; // -1 fresh .. +1 warm (estimation only)
  sweetness: number; // 0..1 (estimation only)
  loudness: number; // 0..1, how much it projects (estimation only)
}

export const AXES = [
  { id: "citrus", label: "Citrus", adjective: "bright", noun: "citrus", halfLifeHours: 0.75, warmth: -0.8, sweetness: 0.1, loudness: 0.3 },
  { id: "green", label: "Green", adjective: "green", noun: "green leaves", halfLifeHours: 1.5, warmth: -0.6, sweetness: 0, loudness: 0.3 },
  { id: "aromatic", label: "Aromatic", adjective: "herbal", noun: "herbs", halfLifeHours: 2, warmth: -0.3, sweetness: 0, loudness: 0.4 },
  { id: "aquatic", label: "Aquatic", adjective: "marine", noun: "sea air", halfLifeHours: 1.5, warmth: -0.9, sweetness: 0, loudness: 0.4 },
  { id: "whiteFloral", label: "White floral", adjective: "creamy floral", noun: "white flowers", halfLifeHours: 4, warmth: 0.1, sweetness: 0.3, loudness: 0.6 },
  { id: "rose", label: "Rose", adjective: "rosy", noun: "rose", halfLifeHours: 4, warmth: 0, sweetness: 0.2, loudness: 0.5 },
  { id: "powderyIris", label: "Powdery / iris", adjective: "powdery", noun: "iris", halfLifeHours: 5, warmth: 0, sweetness: 0.2, loudness: 0.35 },
  { id: "fruity", label: "Fruity", adjective: "fruity", noun: "fruit", halfLifeHours: 1.5, warmth: -0.1, sweetness: 0.6, loudness: 0.5 },
  { id: "gourmand", label: "Gourmand", adjective: "sweet", noun: "vanilla", halfLifeHours: 7, warmth: 0.8, sweetness: 1, loudness: 0.7 },
  { id: "warmSpice", label: "Warm spice", adjective: "spiced", noun: "warm spice", halfLifeHours: 4, warmth: 0.7, sweetness: 0.1, loudness: 0.7 },
  { id: "freshSpice", label: "Fresh spice", adjective: "peppery", noun: "pepper", halfLifeHours: 1.5, warmth: -0.2, sweetness: 0, loudness: 0.5 },
  { id: "dryWoods", label: "Dry woods", adjective: "woody", noun: "cedar", halfLifeHours: 7, warmth: 0.3, sweetness: 0, loudness: 0.5 },
  { id: "creamyWoods", label: "Creamy woods", adjective: "creamy", noun: "sandalwood", halfLifeHours: 8, warmth: 0.4, sweetness: 0.1, loudness: 0.4 },
  { id: "amberResin", label: "Amber / resin", adjective: "ambery", noun: "amber", halfLifeHours: 10, warmth: 0.9, sweetness: 0.4, loudness: 0.8 },
  { id: "musk", label: "Musk", adjective: "musky", noun: "musk", halfLifeHours: 9, warmth: 0.2, sweetness: 0.1, loudness: 0.35 },
  { id: "leatherAnimalic", label: "Leather / animalic", adjective: "leathery", noun: "leather", halfLifeHours: 10, warmth: 0.6, sweetness: 0, loudness: 0.8 },
  { id: "smokeOud", label: "Smoke / oud", adjective: "smoky", noun: "oud", halfLifeHours: 12, warmth: 0.6, sweetness: 0, loudness: 0.95 },
] as const satisfies readonly AxisDef[];

export type AxisId = (typeof AXES)[number]["id"];
export type AccordVector = Record<AxisId, number>;

export const AXIS_IDS: readonly AxisId[] = AXES.map((a) => a.id);

const AXIS_BY_ID = new Map<AxisId, AxisDef>(AXES.map((a) => [a.id, a]));

export function axis(id: AxisId): AxisDef {
  return AXIS_BY_ID.get(id)!;
}

export function emptyVector(): AccordVector {
  return Object.fromEntries(AXIS_IDS.map((id) => [id, 0])) as AccordVector;
}

export function vectorSum(v: AccordVector): number {
  return AXIS_IDS.reduce((sum, id) => sum + v[id], 0);
}

export function cosineSimilarity(a: AccordVector, b: AccordVector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const id of AXIS_IDS) {
    dot += a[id] * b[id];
    na += a[id] * a[id];
    nb += b[id] * b[id];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** Axes sorted by presence, strongest first, dropping near-zero ones. */
export function dominantAxes(v: AccordVector, minPresence = 0.05): AxisId[] {
  return AXIS_IDS.filter((id) => v[id] >= minPresence).sort((a, b) => v[b] - v[a]);
}
