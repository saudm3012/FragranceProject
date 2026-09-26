// Browser-only, per-user IntelliScent state (local until real accounts
// exist - see userStorage.ts): the user's settings, their hand profile
// corrections, their personal clash list, and whether their feedback
// personalizes results.

import { readJSON, writeJSON } from "@/lib/client/userStorage";
import { addAnswer, emptyCheckins, type CheckinAnswer, type WearCheckins } from "@/lib/intelliscent/checkins";
import { pairKey } from "@/lib/intelliscent/engine";
import { isEmptyOverride, sanitizeOverride, type ProfileOverride } from "@/lib/intelliscent/profile";
import { normalizeSettings, type IntelliScentSettings } from "@/lib/intelliscent/settings";

export const SETTINGS_NAMESPACE = "intelliscent_settings";
export const OVERRIDES_NAMESPACE = "profile_overrides";
export const CLASH_NAMESPACE = "clash_list";
export const PREFS_NAMESPACE = "intelliscent_prefs";
export const CHECKINS_NAMESPACE = "wear_checkins";

export interface IntelliScentPrefs {
  personalization: boolean; // apply the feedback-driven personal layer
}
export const DEFAULT_PREFS: IntelliScentPrefs = { personalization: true };

export function setSettings(username: string, settings: IntelliScentSettings): void {
  writeJSON(SETTINGS_NAMESPACE, username, normalizeSettings(settings));
}

export function setPrefs(username: string, prefs: IntelliScentPrefs): void {
  writeJSON(PREFS_NAMESPACE, username, prefs);
}

export function getOverrides(username: string): Record<string, ProfileOverride> {
  return readJSON<Record<string, ProfileOverride>>(OVERRIDES_NAMESPACE, username, {});
}

/** Saves (or, if empty, removes) the user's hand corrections for one fragrance. */
export function setOverride(username: string, fragranceId: number, override: ProfileOverride): void {
  const clean = sanitizeOverride(override);
  const all = { ...getOverrides(username) };
  if (isEmptyOverride(clean)) delete all[String(fragranceId)];
  else all[String(fragranceId)] = clean;
  writeJSON(OVERRIDES_NAMESPACE, username, all);
}

export function getClashPairs(username: string): Array<[number, number]> {
  return readJSON<Array<[number, number]>>(CLASH_NAMESPACE, username, []);
}

/** Adds every pair within `ids` to the personal clash list. */
export function addClashes(username: string, ids: number[]): void {
  const existing = getClashPairs(username);
  const keys = new Set(existing.map(([a, b]) => pairKey(a, b)));
  const next = [...existing];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (!keys.has(pairKey(ids[i], ids[j]))) next.push([ids[i], ids[j]]);
    }
  }
  writeJSON(CLASH_NAMESPACE, username, next);
}

/** Removes every pair within `ids` from the personal clash list. */
export function removeClashes(username: string, ids: number[]): void {
  const drop = new Set<string>();
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) drop.add(pairKey(ids[i], ids[j]));
  writeJSON(
    CLASH_NAMESPACE,
    username,
    getClashPairs(username).filter(([a, b]) => !drop.has(pairKey(a, b)))
  );
}

export function getCheckins(username: string): Record<string, WearCheckins> {
  return readJSON<Record<string, WearCheckins>>(CHECKINS_NAMESPACE, username, {});
}

/** Records one wear's yes/no answers, per fragrance. */
export function recordCheckins(username: string, answers: Record<number, CheckinAnswer>): void {
  const all = { ...getCheckins(username) };
  for (const [id, answer] of Object.entries(answers)) {
    all[id] = addAnswer(all[id] ?? emptyCheckins(), answer);
  }
  writeJSON(CHECKINS_NAMESPACE, username, all);
}
