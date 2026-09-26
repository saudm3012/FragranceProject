// Typed browser-side wrappers around the app's own API routes, so
// components don't hand-roll fetch URLs and error handling.

import type { Candidate, Fragrance, SearchResponse } from "@/lib/schemas";
import type {
  ProfilesRequest,
  ProfilesResponse,
  RateRequest,
  RateResponse,
  SuggestRequest,
  SuggestResponse,
} from "@/lib/intelliscent/types";

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function postJSON<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchFragrancesByIds(ids: number[]): Promise<Fragrance[]> {
  return request<Fragrance[]>(`/api/fragrances?ids=${ids.join(",")}`);
}

/** One page of live search results (page is 0-based). */
export function searchFragrances(query: string, page = 0): Promise<SearchResponse> {
  return request<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
}

/** Stores a search hit instantly (as a stub if new) - its details are fetched server-side in the background. */
export function quickAdd(candidate: Candidate): Promise<Fragrance> {
  return postJSON<Fragrance>("/api/fragrance/quick-add", candidate);
}

/**
 * Resolves a search candidate to a full, stored Fragrance (fetches and
 * caches it server-side if new - can take several seconds). Pass a signal
 * to cancel waiting for it; the server still finishes and stores the
 * record, so reopening it later is instant.
 */
export function resolveFragrance(url: string, signal?: AbortSignal): Promise<Fragrance> {
  return request<Fragrance>(`/api/fragrance?url=${encodeURIComponent(url)}`, { signal });
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function suggestLayers(body: SuggestRequest): Promise<SuggestResponse> {
  return postJSON<SuggestResponse>("/api/intelliscent/suggest", body);
}

export function rateCombo(body: RateRequest): Promise<RateResponse> {
  return postJSON<RateResponse>("/api/intelliscent/rate", body);
}

export function fetchProfiles(body: ProfilesRequest): Promise<ProfilesResponse> {
  return postJSON<ProfilesResponse>("/api/intelliscent/profiles", body);
}
