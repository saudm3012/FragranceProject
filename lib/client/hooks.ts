// React bindings for the browser-side stores (username, per-user
// localStorage data, the shared fragrance cache). Built on
// useSyncExternalStore so every subscribed component stays in sync when
// any of them writes, with no provider/context to thread through.

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  COLLECTION_NAMESPACE,
  getUsername,
  USERNAME_CHANGED_EVENT,
  type LocalCollectionEntry,
} from "@/lib/client/localCollection";
import { COMBOS_NAMESPACE, normalizeCombo, type Combo } from "@/lib/client/localCombos";
import {
  CLASH_NAMESPACE,
  DEFAULT_PREFS,
  OVERRIDES_NAMESPACE,
  PREFS_NAMESPACE,
  SETTINGS_NAMESPACE,
  setPrefs,
  setSettings,
  type IntelliScentPrefs,
} from "@/lib/client/localIntelliScent";
import { readRaw, STORE_CHANGED_EVENT } from "@/lib/client/userStorage";
import * as fragranceCache from "@/lib/client/fragranceCache";
import { applyPersonalModel, buildPersonalModel, type PersonalModel } from "@/lib/intelliscent/personalization";
import type { ProfileOverride } from "@/lib/intelliscent/profile";
import { normalizeSettings, type IntelliScentSettings } from "@/lib/intelliscent/settings";
import type { EnginePayload } from "@/lib/intelliscent/types";
import type { Fragrance } from "@/lib/schemas";

function subscribeTo(eventName: string) {
  return (callback: () => void) => {
    window.addEventListener(eventName, callback);
    window.addEventListener("storage", callback); // other browser tabs
    return () => {
      window.removeEventListener(eventName, callback);
      window.removeEventListener("storage", callback);
    };
  };
}

const subscribeUsername = subscribeTo(USERNAME_CHANGED_EVENT);
const subscribeStore = subscribeTo(STORE_CHANGED_EVENT);
const subscribeNever = () => () => {};

function parseOr<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** False during server render and hydration, true after - for UI that depends on localStorage. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

/** `undefined` until hydrated (unknown), then the username or `null` if none is set. */
export function useUsername(): string | null | undefined {
  const hydrated = useHydrated();
  const username = useSyncExternalStore(subscribeUsername, getUsername, () => null);
  return hydrated ? username : undefined;
}

/** Raw JSON string for one per-user namespace. A primitive, so it's a stable snapshot. */
function useStoreRaw(namespace: string, username: string | null | undefined): string | null {
  return useSyncExternalStore(
    subscribeStore,
    () => (username ? readRaw(namespace, username) : null),
    () => null
  );
}

export function useCollectionIds(username: string | null | undefined): number[] {
  const raw = useStoreRaw(COLLECTION_NAMESPACE, username);
  return useMemo(() => parseOr<LocalCollectionEntry[]>(raw, []).map((e) => e.fragranceId), [raw]);
}

export function useCombos(username: string | null | undefined): Combo[] {
  const raw = useStoreRaw(COMBOS_NAMESPACE, username);
  return useMemo(
    () => parseOr<Array<Partial<Combo> & { id: string; fragranceIds: number[] }>>(raw, []).map(normalizeCombo),
    [raw]
  );
}

/**
 * The user's own IntelliScent settings (before personal nudges), always
 * normalized against the current settings schema so older saved settings
 * keep working as settings are added or removed.
 */
export function useIntelliScentSettings(
  username: string | null | undefined
): [IntelliScentSettings, (next: IntelliScentSettings) => void] {
  const raw = useStoreRaw(SETTINGS_NAMESPACE, username);
  const settings = useMemo(() => normalizeSettings(parseOr<unknown>(raw, null)), [raw]);
  const update = useCallback((next: IntelliScentSettings) => username && setSettings(username, next), [username]);
  return [settings, update];
}

export function useIntelliScentPrefs(
  username: string | null | undefined
): [IntelliScentPrefs, (next: IntelliScentPrefs) => void] {
  const raw = useStoreRaw(PREFS_NAMESPACE, username);
  const prefs = useMemo(() => ({ ...DEFAULT_PREFS, ...parseOr<Partial<IntelliScentPrefs>>(raw, {}) }), [raw]);
  const update = useCallback((next: IntelliScentPrefs) => username && setPrefs(username, next), [username]);
  return [prefs, update];
}

export function useProfileOverrides(username: string | null | undefined): Record<string, ProfileOverride> {
  const raw = useStoreRaw(OVERRIDES_NAMESPACE, username);
  return useMemo(() => parseOr<Record<string, ProfileOverride>>(raw, {}), [raw]);
}

export function useClashPairs(username: string | null | undefined): Array<[number, number]> {
  const raw = useStoreRaw(CLASH_NAMESPACE, username);
  return useMemo(() => parseOr<Array<[number, number]>>(raw, []), [raw]);
}

/** The personal preference layer, rebuilt from every wear logged in the combo journal. */
export function usePersonalModel(username: string | null | undefined): PersonalModel {
  const combos = useCombos(username);
  return useMemo(() => buildPersonalModel(combos.flatMap((c) => c.feedback)), [combos]);
}

/**
 * Everything the IntelliScent API needs for this user: their settings with
 * personal nudges applied (unless personalization is off), the personal
 * matrix layer, their profile corrections and their clash list.
 */
export function useEnginePayload(username: string | null | undefined): {
  payload: EnginePayload;
  settings: IntelliScentSettings; // the user's own, un-nudged
  setSettings: (next: IntelliScentSettings) => void;
  prefs: IntelliScentPrefs;
  setPrefs: (next: IntelliScentPrefs) => void;
  personal: PersonalModel;
} {
  const [settings, updateSettings] = useIntelliScentSettings(username);
  const [prefs, updatePrefs] = useIntelliScentPrefs(username);
  const personal = usePersonalModel(username);
  const overrides = useProfileOverrides(username);
  const clashPairs = useClashPairs(username);
  const payload = useMemo<EnginePayload>(
    () =>
      prefs.personalization
        ? { settings: applyPersonalModel(settings, personal), personal, overrides, clashPairs }
        : { settings, personal: null, overrides, clashPairs },
    [settings, prefs.personalization, personal, overrides, clashPairs]
  );
  return { payload, settings, setSettings: updateSettings, prefs, setPrefs: updatePrefs, personal };
}

/**
 * Full Fragrance records for `ids`, fetched on demand and shared across all
 * components via the fragrance cache. `get` returns undefined for ids still
 * loading or not found; `loading` is true while any requested id is unsettled.
 */
export function useFragrances(ids: number[]): {
  get: (id: number) => Fragrance | undefined;
  loading: boolean;
} {
  const key = [...new Set(ids)].sort((a, b) => a - b).join(",");
  useEffect(() => {
    if (key) void fragranceCache.ensure(key.split(",").map(Number));
  }, [key]);
  useSyncExternalStore(fragranceCache.subscribe, fragranceCache.getVersion, () => 0);
  return {
    get: fragranceCache.getCached,
    loading: ids.some((id) => !fragranceCache.hasSettled(id)),
  };
}
