// Spray counts, shared by the recipe and by scoring (3+ scent combos judge
// accents against the spray-weighted anchor+modifier blend).

import { emptyVector, AXIS_IDS } from "@/lib/intelliscent/axes";
import type { FragranceProfile } from "@/lib/intelliscent/profile";
import type { IntelliScentSettings } from "@/lib/intelliscent/settings";
import type { Role } from "@/lib/intelliscent/engine/types";

const SPRAY_NUMERATOR = 6; // strength 5 -> 1 spray, strength 2 -> 3 sprays (the framework's example ratio)
export const MAX_SPRAYS = 4; // layering cap; skin-scents worn solo often go higher, but not in a layer

/**
 * The strength used for dosing: projection-weighted, since sprays are
 * about comparable loudness at the moment of application. (The mismatch
 * penalty uses the plain projection/longevity average - presence over the
 * whole wear is what needs to balance there.)
 */
export function sprayStrength(p: FragranceProfile): number {
  return 0.75 * p.projection + 0.25 * p.longevity;
}

export function spraysFor(p: FragranceProfile, role: Role, s: IntelliScentSettings): number {
  const base = role === "accent" ? 1 : SPRAY_NUMERATOR / sprayStrength(p);
  return Math.min(MAX_SPRAYS, Math.max(1, Math.round(base * s.sprayMultiplier)));
}

/**
 * Anchor and modifier worn together read as one scent field. A stand-in
 * profile whose accords are their spray-weighted mix, for judging accents
 * against (only `accords` is meaningful on it).
 */
export function blendOf(
  parts: Array<{ profile: FragranceProfile; sprays: number }>
): FragranceProfile {
  const accords = emptyVector();
  const total = parts.reduce((sum, p) => sum + p.sprays, 0) || 1;
  for (const { profile, sprays } of parts) {
    for (const id of AXIS_IDS) accords[id] += (profile.accords[id] * sprays) / total;
  }
  return { ...parts[0].profile, fragranceId: -1, accords };
}
