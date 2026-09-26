// "From score to recipe" in the framework: spray ratio, application order
// and placement, and a predicted blend description. The description is
// template-based (no LLM): take the spray-weighted accord mix at the
// opening, mid-wear and drydown, and name the dominant families.

import { AXIS_IDS, axis, type AccordVector, type AxisId } from "@/lib/intelliscent/axes";
import { strength, type FragranceProfile } from "@/lib/intelliscent/profile";
import type { Recipe, RecipeStep, Role, ScoredCombo } from "@/lib/intelliscent/engine/types";

const SPRAY_NUMERATOR = 6; // strength 5 -> 1 spray, strength 2 -> 3 sprays (the framework's example ratio)
const MAX_SPRAYS = 4;
const DELICATE_MODIFIER_MAX = 2.5; // a modifier this weak ...
const POWERHOUSE_ANCHOR_MIN = 3.75; // ... next to an anchor this strong goes on clothing instead

export const SKIN_TEST_NOTE =
  "Treat this as a starting hypothesis: skin chemistry and climate aren't modeled, so test it on skin before wearing it somewhere that matters.";

function sprays(p: FragranceProfile, role: Role): number {
  if (role === "accent") return 1;
  return Math.min(MAX_SPRAYS, Math.max(1, Math.round(SPRAY_NUMERATOR / strength(p))));
}

function placement(p: FragranceProfile, role: Role, anchor: FragranceProfile): string {
  if (role === "anchor") return "On skin first - pulse points like neck and chest, where body warmth develops the base over hours.";
  if (role === "accent") return "One light spray on clothing or hair, applied last so it sits on top.";
  if (strength(p) <= DELICATE_MODIFIER_MAX && strength(anchor) >= POWERHOUSE_ANCHOR_MIN) {
    return "On clothing or hair rather than skin, so the anchor doesn't swallow it.";
  }
  return "On top of the anchor, same spots.";
}

/** Spray-weighted accord mix at `hours` into wear, each family fading at its own half-life. */
function mixAt(steps: Array<{ profile: FragranceProfile; sprays: number }>, hours: number): AccordVector {
  const mix = Object.fromEntries(AXIS_IDS.map((id) => [id, 0])) as AccordVector;
  for (const { profile, sprays: n } of steps) {
    const stretch = 0.5 + 0.25 * (profile.longevity - 1);
    for (const id of AXIS_IDS) {
      mix[id] += n * profile.accords[id] * Math.pow(2, -hours / (axis(id).halfLifeHours * stretch));
    }
  }
  return mix;
}

function top(mix: AccordVector, n: number, exclude: AxisId[] = []): AxisId[] {
  return AXIS_IDS.filter((id) => mix[id] > 0.01 && !exclude.includes(id))
    .sort((a, b) => mix[b] - mix[a])
    .slice(0, n);
}

function phrase(ids: AxisId[]): string {
  if (ids.length === 0) return "";
  if (ids.length === 1) return axis(ids[0]).noun;
  return `${axis(ids[0]).adjective} ${axis(ids[1]).noun}`;
}

export function describeBlend(steps: Array<{ profile: FragranceProfile; sprays: number }>): string {
  const heart = top(mixAt(steps, 2), 2);
  if (heart.length === 0) return "Not enough accord data to describe this blend.";
  const opening = top(mixAt(steps, 0), 2, heart);
  const drydown = top(mixAt(steps, 8), 2);

  let sentence = phrase(heart);
  if (opening.length) sentence += ` with a ${opening.map((id) => axis(id).noun).join(" and ")} opening`;
  const dry = phrase(drydown);
  sentence += dry && dry !== phrase(heart) ? `, settling into ${dry} by the afternoon.` : " that holds through the afternoon.";
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function buildRecipe(combo: ScoredCombo, profilesById: ReadonlyMap<number, FragranceProfile>): Recipe {
  const anchor = profilesById.get(combo.fragranceIds[0])!;
  const steps: RecipeStep[] = combo.fragranceIds.map((id, i) => {
    const p = profilesById.get(id)!;
    const role = combo.roles[i];
    return { fragranceId: id, role, sprays: sprays(p, role), placement: placement(p, role, anchor) };
  });
  return {
    steps,
    description: describeBlend(steps.map((s) => ({ profile: profilesById.get(s.fragranceId)!, sprays: s.sprays }))),
    skinTest: SKIN_TEST_NOTE,
  };
}
