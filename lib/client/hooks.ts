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
import { COMBOS_NAMESPACE, type Combo } from "@/lib/client/localCombos";
import { readRaw, STORE_CHANGED_EVENT, writeJSON } from "@/lib/client/userStorage";
import * as fragranceCache from "@/lib/client/fragranceCache";
import { normalizeParams, type IntelliScentParams } from "@/lib/intelliscent/params";
import type { Fragrance } from "@/lib/schemas";

export const INTELLISCENT_PARAMS_NAMESPACE = "intelliscent_params";

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
  return useMemo(() => parseOr<Combo[]>(raw, []), [raw]);
}

/**
 * The user's IntelliScent settings, persisted per username. Always
 * normalized against the current param registry, so adding/removing a
 * param in lib/intelliscent/params.ts never breaks previously saved settings.
 */
export function useIntelliScentParams(
  username: string | null | undefined
): [IntelliScentParams, (next: IntelliScentParams) => void] {
  const raw = useStoreRaw(INTELLISCENT_PARAMS_NAMESPACE, username);
  const params = useMemo(() => normalizeParams(parseOr<unknown>(raw, null)), [raw]);
  const setParams = useCallback(
    (next: IntelliScentParams) => {
      if (username) writeJSON(INTELLISCENT_PARAMS_NAMESPACE, username, normalizeParams(next));
    },
    [username]
  );
  return [params, setParams];
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
