// Browser-only, generic per-username JSON storage in localStorage. Every
// piece of user-owned client state (collection, combos, IntelliScent
// settings, ...) is one "namespace" here, stored under
// `fragrantica_<namespace>:<username>`. Writes dispatch a change event so
// any mounted UI subscribed via useUserStore() (see hooks.ts) re-renders -
// including other tabs, via the native `storage` event.
//
// Why local and not Turso: there's no password yet, so a typed username
// can't be trusted to gate server-side data (anyone could claim any name).
// Once real auth exists this is the one module to swap for a server-backed
// store.

export const STORE_CHANGED_EVENT = "fragrantica-store-changed";

export function storageKey(namespace: string, username: string): string {
  return `fragrantica_${namespace}:${username}`;
}

export function readRaw(namespace: string, username: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey(namespace, username));
}

export function readJSON<T>(namespace: string, username: string, fallback: T): T {
  const raw = readRaw(namespace, username);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(namespace: string, username: string, value: T): void {
  window.localStorage.setItem(storageKey(namespace, username), JSON.stringify(value));
  window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
}
