// Browser-only. The user's layering journal: saved combinations of 2+
// fragrances, each with the IntelliScent result it was saved with and a
// log of wears (rating + reason tags) that drives personalization. Stored
// per username in localStorage (see userStorage.ts for why it's local).

import { readJSON, writeJSON } from "@/lib/client/userStorage";
import type { ComboTerms, Penalty, Recipe, Role } from "@/lib/intelliscent/engine";
import type { FeedbackEvent } from "@/lib/intelliscent/personalization";

export const COMBOS_NAMESPACE = "combos";

/** Where a combo was created - extend as new ways to create combos are added. */
export type ComboSource = "suggestion" | "match";

/** The IntelliScent result a combo was saved with (a frozen copy - later setting changes don't rewrite history). */
export interface ComboSnapshot {
  fragranceIds: number[]; // role order
  roles: Role[];
  score: number; // 0-1
  terms: ComboTerms;
  penalties: Penalty[];
  structureNote: string | null;
  recipe: Recipe;
}

export interface Combo {
  id: string;
  fragranceIds: number[];
  source: ComboSource;
  snapshot: ComboSnapshot | null;
  notes: string; // free-text journal entry
  feedback: FeedbackEvent[]; // one per logged wear
  createdAt: string;
  updatedAt: string;
}

export type NewCombo = Pick<Combo, "fragranceIds" | "source"> & Partial<Pick<Combo, "snapshot" | "notes">>;

/** Freezes the parts of an API result worth keeping with a saved combo. */
export function snapshotOf(result: ComboSnapshot): ComboSnapshot {
  const { fragranceIds, roles, score, terms, penalties, structureNote, recipe } = result;
  return { fragranceIds, roles, score, terms, penalties, structureNote, recipe };
}

/** Order-insensitive identity for a set of fragrances, used to avoid saving the same combo twice. */
export function comboKey(fragranceIds: number[]): string {
  return [...new Set(fragranceIds)].sort((a, b) => a - b).join("+");
}

/** Fills in fields missing from combos saved by earlier versions of the app. */
export function normalizeCombo(raw: Partial<Combo> & { id: string; fragranceIds: number[] }): Combo {
  const now = new Date().toISOString();
  return {
    id: raw.id,
    fragranceIds: raw.fragranceIds,
    source: raw.source ?? "match",
    snapshot: raw.snapshot && Array.isArray(raw.snapshot.roles) ? raw.snapshot : null,
    notes: raw.notes ?? "",
    feedback: Array.isArray(raw.feedback) ? raw.feedback : [],
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? now,
  };
}

export function getCombos(username: string): Combo[] {
  return readJSON<Array<Partial<Combo> & { id: string; fragranceIds: number[] }>>(COMBOS_NAMESPACE, username, []).map(
    normalizeCombo
  );
}

function save(username: string, combos: Combo[]): void {
  writeJSON(COMBOS_NAMESPACE, username, combos);
}

export function findCombo(username: string, fragranceIds: number[]): Combo | undefined {
  const key = comboKey(fragranceIds);
  return getCombos(username).find((c) => comboKey(c.fragranceIds) === key);
}

/** Saves a combo, or returns the existing one if this exact set of fragrances is already saved. */
export function addCombo(username: string, input: NewCombo): Combo {
  const existing = findCombo(username, input.fragranceIds);
  if (existing) return existing;

  const now = new Date().toISOString();
  const combo: Combo = {
    id: crypto.randomUUID(),
    fragranceIds: [...new Set(input.fragranceIds)],
    source: input.source,
    snapshot: input.snapshot ?? null,
    notes: input.notes ?? "",
    feedback: [],
    createdAt: now,
    updatedAt: now,
  };
  save(username, [...getCombos(username), combo]);
  return combo;
}

function update(username: string, id: string, change: (c: Combo) => Combo): void {
  save(
    username,
    getCombos(username).map((c) => (c.id === id ? { ...change(c), updatedAt: new Date().toISOString() } : c))
  );
}

export function setSnapshot(username: string, id: string, snapshot: ComboSnapshot): void {
  update(username, id, (c) => ({ ...c, snapshot }));
}

export function updateNotes(username: string, id: string, notes: string): void {
  update(username, id, (c) => ({ ...c, notes }));
}

export function addFeedback(username: string, id: string, event: FeedbackEvent): void {
  update(username, id, (c) => ({ ...c, feedback: [...c.feedback, event] }));
}

export function removeFeedback(username: string, id: string, eventId: string): void {
  update(username, id, (c) => ({ ...c, feedback: c.feedback.filter((e) => e.id !== eventId) }));
}

export function deleteCombo(username: string, id: string): void {
  save(
    username,
    getCombos(username).filter((c) => c.id !== id)
  );
}
