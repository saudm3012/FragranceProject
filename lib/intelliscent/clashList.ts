// The framework's curated clash list: specific pairs known to clash in
// ways the formula can't model (e.g. two "clean" musks slightly off-key
// together). Keyed by Fragrantica URL path so entries survive database
// rebuilds. Intentionally empty - no verified entries yet. Users also keep
// a personal clash list (client-side), merged with this at request time.

export interface CuratedClash {
  a: string; // Fragrantica path, e.g. "/perfume/Dior/Sauvage-31861.html"
  b: string;
  reason: string;
}

export const CURATED_CLASHES: readonly CuratedClash[] = [];

export function fragranticaPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
