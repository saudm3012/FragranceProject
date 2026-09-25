// Browser-only. The user's layering journal: saved combinations of 2+
// fragrances, stored per username in localStorage (see userStorage.ts for
// why this is local rather than server-side for now).

import { readJSON, writeJSON } from "@/lib/client/userStorage";
import type { IntelliScentParams } from "@/lib/intelliscent/params";

export const COMBOS_NAMESPACE = "combos";

/** Where a combo was created - extend as new ways to create combos are added. */
export type ComboSource = "suggestion" | "match";

export interface Combo {
  id: string;
  fragranceIds: number[];
  source: ComboSource;
  score: number | null; // IntelliScent score at the time it was saved, if it was scored
  scoreLabel: string | null;
  params: IntelliScentParams | null; // the IntelliScent settings in effect when saved
  notes: string; // the user's journal entry
  createdAt: string;
  updatedAt: string;
}

export type NewCombo = Pick<Combo, "fragranceIds" | "source"> &
  Partial<Pick<Combo, "score" | "scoreLabel" | "params" | "notes">>;

/** Order-insensitive identity for a set of fragrances, used to avoid saving the same combo twice. */
export function comboKey(fragranceIds: number[]): string {
  return [...new Set(fragranceIds)].sort((a, b) => a - b).join("+");
}

export function getCombos(username: string): Combo[] {
  return readJSON<Combo[]>(COMBOS_NAMESPACE, username, []);
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
    score: input.score ?? null,
    scoreLabel: input.scoreLabel ?? null,
    params: input.params ?? null,
    notes: input.notes ?? "",
    createdAt: now,
    updatedAt: now,
  };
  writeJSON(COMBOS_NAMESPACE, username, [...getCombos(username), combo]);
  return combo;
}

export function updateCombo(
  username: string,
  id: string,
  patch: Partial<Pick<Combo, "notes" | "score" | "scoreLabel" | "params">>
): void {
  const next = getCombos(username).map((c) =>
    c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
  );
  writeJSON(COMBOS_NAMESPACE, username, next);
}

export function deleteCombo(username: string, id: string): void {
  writeJSON(
    COMBOS_NAMESPACE,
    username,
    getCombos(username).filter((c) => c.id !== id)
  );
}
