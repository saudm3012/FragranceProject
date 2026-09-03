// Browser-only. There's no password yet (see plan: username is a stand-in
// for a real account, coming later), so it would be unsafe to let a typed
// username read/write another person's collection on the server - anyone
// could claim any name. Until real auth exists, "the collection" lives
// entirely in this browser's localStorage, namespaced by username. The
// shared fragrance *data* (notes, accords, etc.) still lives in Turso via
// the existing API - only "which fragrances are mine" is local.

const USERNAME_KEY = "fragrantica_username";
export const USERNAME_CHANGED_EVENT = "fragrantica-username-changed";

export interface LocalCollectionEntry {
  fragranceId: number;
  addedAt: string;
}

export function getUsername(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USERNAME_KEY);
}

export function setUsername(username: string): void {
  window.localStorage.setItem(USERNAME_KEY, username.trim());
  window.dispatchEvent(new Event(USERNAME_CHANGED_EVENT));
}

export function clearUsername(): void {
  window.localStorage.removeItem(USERNAME_KEY);
  window.dispatchEvent(new Event(USERNAME_CHANGED_EVENT));
}

function collectionKey(username: string): string {
  return `fragrantica_collection:${username}`;
}

export function getCollection(username: string): LocalCollectionEntry[] {
  const raw = window.localStorage.getItem(collectionKey(username));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LocalCollectionEntry[];
  } catch {
    return [];
  }
}

export function isInCollection(username: string, fragranceId: number): boolean {
  return getCollection(username).some((e) => e.fragranceId === fragranceId);
}

export function addToCollection(username: string, fragranceId: number): void {
  const current = getCollection(username);
  if (current.some((e) => e.fragranceId === fragranceId)) return;
  current.push({ fragranceId, addedAt: new Date().toISOString() });
  window.localStorage.setItem(collectionKey(username), JSON.stringify(current));
}

export function removeFromCollection(username: string, fragranceId: number): void {
  const current = getCollection(username).filter((e) => e.fragranceId !== fragranceId);
  window.localStorage.setItem(collectionKey(username), JSON.stringify(current));
}
