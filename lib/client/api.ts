// Typed browser-side wrappers around the app's own API routes, so
// components don't hand-roll fetch URLs and error handling.

import type { Candidate, Fragrance, SearchResponse } from "@/lib/schemas";
import type { RateRequest, RateResponse, SuggestRequest, SuggestResponse } from "@/lib/intelliscent/types";

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

export async function searchFragrances(query: string): Promise<Candidate[]> {
  const data = await request<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`);
  return data.candidates;
}

/** Resolves a search candidate to a full, stored Fragrance (fetches and caches it server-side if new - can take several seconds). */
export function resolveFragrance(url: string): Promise<Fragrance> {
  return request<Fragrance>(`/api/fragrance?url=${encodeURIComponent(url)}`);
}

export function suggestLayers(body: SuggestRequest): Promise<SuggestResponse> {
  return postJSON<SuggestResponse>("/api/intelliscent/suggest", body);
}

export function rateCombo(body: RateRequest): Promise<RateResponse> {
  return postJSON<RateResponse>("/api/intelliscent/rate", body);
}
