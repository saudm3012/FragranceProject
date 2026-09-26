// Browser-only, in-memory cache of full Fragrance records keyed by id,
// shared by every component on the page (combos, collection grid,
// suggestions all refer to fragrances by id). Components subscribe via
// useFragrances() in hooks.ts; this module just holds state and notifies.

import { fetchFragrancesByIds } from "@/lib/client/api";
import { isStub, type Fragrance } from "@/lib/schemas";

const cache = new Map<number, Fragrance>();
const pending = new Set<number>();
const failed = new Set<number>(); // fetched but not found / errored - don't show these as loading forever
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVersion(): number {
  return version;
}

export function getCached(id: number): Fragrance | undefined {
  return cache.get(id);
}

/** True once a fetch for `id` has finished, whether or not it found anything. */
export function hasSettled(id: number): boolean {
  return cache.has(id) || failed.has(id);
}

/** Adds fragrances the caller already has in hand (e.g. from a suggest/resolve response). */
export function prime(fragrances: Fragrance[]): void {
  let changed = false;
  for (const f of fragrances) {
    if (f.id != null) {
      cache.set(f.id, f);
      changed = true;
    }
  }
  if (changed) emit();
}

/** Fetches any of `ids` not already cached or in flight. */
export function ensure(ids: number[]): Promise<void> {
  return load([...new Set(ids)].filter((id) => !cache.has(id) && !pending.has(id)));
}

/** Re-fetches any of `ids` that are cached as stubs (quick-added, details still loading server-side). */
export function refreshStubs(ids: number[]): Promise<void> {
  return load(
    [...new Set(ids)].filter((id) => {
      const f = cache.get(id);
      return f !== undefined && isStub(f) && !pending.has(id);
    })
  );
}

export function isCachedStub(id: number): boolean {
  const f = cache.get(id);
  return f !== undefined && isStub(f);
}

async function load(missing: number[]): Promise<void> {
  if (missing.length === 0) return;

  missing.forEach((id) => pending.add(id));
  emit();
  try {
    prime(await fetchFragrancesByIds(missing));
  } catch {
    // Handled below: anything still uncached is marked failed.
  } finally {
    missing.forEach((id) => {
      pending.delete(id);
      if (!cache.has(id)) failed.add(id);
    });
    emit();
  }
}
