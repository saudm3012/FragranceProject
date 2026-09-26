// Quick post-wear check-ins: yes/no answers about how one of the user's
// own bottles actually behaved. Community votes are a noisy aggregate, so
// anything a user confirms from real wear outweighs the Fragrantica-based
// estimate for their bottles. Applied between the estimate and hand edits:
//   estimate -> check-ins ("From your wears") -> hand edits ("Your edit").

import type { FragranceProfile, TimeProfile } from "@/lib/intelliscent/profile";

export interface WearCheckins {
  h4: { yes: number; no: number }; // "Still noticeable at 4 hours?"
  h8: { yes: number; no: number }; // "Still noticeable at 8 hours?"
  occasion: { office: number; evening: number }; // "More office or evening to you?"
}

export type CheckinAnswer = { h4?: boolean; h8?: boolean; occasion?: "office" | "evening" };

/** Occasion fit is a low-confidence estimate; ask this many times per fragrance, then stop. */
export const OCCASION_QUESTION_LIMIT = 2;

export function emptyCheckins(): WearCheckins {
  return { h4: { yes: 0, no: 0 }, h8: { yes: 0, no: 0 }, occasion: { office: 0, evening: 0 } };
}

export function addAnswer(c: WearCheckins, a: CheckinAnswer): WearCheckins {
  const next = structuredClone(c);
  if (a.h4 !== undefined) next.h4[a.h4 ? "yes" : "no"] += 1;
  if (a.h8 !== undefined) next.h8[a.h8 ? "yes" : "no"] += 1;
  if (a.occasion) next.occasion[a.occasion] += 1;
  return next;
}

const NOTICEABLE: Record<"h4" | "h8", number> = { h4: 0.4, h8: 0.3 }; // "yes" means at least this intensity
const FADED = 0.1; // "no" means at most this

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Coerces untrusted input (request body, localStorage) into valid check-in counts. */
export function sanitizeCheckins(input: unknown): WearCheckins | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, Record<string, unknown> | undefined>;
  return {
    h4: { yes: num(o.h4?.yes), no: num(o.h4?.no) },
    h8: { yes: num(o.h8?.yes), no: num(o.h8?.no) },
    occasion: { office: num(o.occasion?.office), evening: num(o.occasion?.evening) },
  };
}

export function applyCheckins(profile: FragranceProfile, input: WearCheckins | null | undefined): FragranceProfile {
  const c = sanitizeCheckins(input);
  if (!c) return profile;

  const time: TimeProfile = { ...profile.time };
  let timeTouched = false;
  for (const k of ["h4", "h8"] as const) {
    const { yes, no } = c[k];
    if (yes > no) time[k] = Math.max(time[k], NOTICEABLE[k]);
    else if (no > yes) time[k] = Math.min(time[k], FADED);
    else continue;
    timeTouched = true;
  }
  // Keep the curve non-increasing (a scent can't be stronger later than earlier).
  time.h4 = Math.max(time.h4, time.h8);
  time.h1 = Math.max(time.h1, time.h4);
  time.h0 = Math.max(time.h0, time.h1);

  const occasions = { ...profile.context.occasions };
  const { office, evening } = c.occasion;
  let occasionTouched = true;
  if (office > evening) {
    occasions.office = Math.max(occasions.office, 0.75);
    occasions.dateNight = Math.min(occasions.dateNight, 0.45);
  } else if (evening > office) {
    occasions.dateNight = Math.max(occasions.dateNight, 0.75);
    occasions.office = Math.min(occasions.office, 0.4);
  } else {
    occasionTouched = false;
  }

  return {
    ...profile,
    time,
    context: { ...profile.context, occasions },
    sources: {
      ...profile.sources,
      ...(timeTouched ? { time: "checkins" as const } : {}),
      ...(occasionTouched ? { occasions: "checkins" as const } : {}),
    },
  };
}
