import { fetchPage } from "@/lib/scraping/fetch";
import { parseFragrancePage } from "@/lib/scraping/parse";
import { searchLive } from "@/lib/scraping/search";
import * as fragranceRepository from "@/lib/fragranceRepository";
import type { Candidate, Fragrance, SearchResponse } from "@/lib/schemas";

/**
 * Resolves a free-text name to ranked candidates. Cache-first: if fuzzy
 * matching against already-cached fragrances turns up decent hits, use
 * those (no network call); otherwise fall back to a live Algolia search.
 * Always returns a list - callers decide how to handle 0/1/many results,
 * never auto-picks a single "best" match.
 */
export async function search(query: string): Promise<SearchResponse> {
  const cacheHits = await fragranceRepository.searchByName(query, 10);
  if (cacheHits.length > 0) {
    const fragrances = await fragranceRepository.getByIds(cacheHits.map((h) => h.id));
    const candidates: Candidate[] = fragrances.map((f) => ({
      name: f.name,
      brand: f.brand,
      url: f.url,
    }));
    return { source: "cache", candidates };
  }

  const candidates = await searchLive(query, 10);
  return { source: "live_search", candidates };
}

/**
 * Resolves a single fragrance by URL: cache read if we already have it,
 * otherwise fetch + parse + store, then return the stored record.
 */
export async function lookupByUrl(url: string): Promise<Fragrance> {
  const existing = await fragranceRepository.getByUrl(url);
  if (existing) return existing;

  const { html } = await fetchPage(url);
  const parsed = parseFragrancePage(html, url);
  const id = await fragranceRepository.upsert(parsed);
  return { ...parsed, id };
}

export async function lookupById(id: number): Promise<Fragrance | null> {
  return fragranceRepository.getById(id);
}
