import { fetchPage } from "@/lib/scraping/fetch";
import { parseFragrancePage } from "@/lib/scraping/parse";
import { searchLive } from "@/lib/scraping/search";
import * as fragranceRepository from "@/lib/fragranceRepository";
import {
  CUSTOM_URL_PREFIX,
  isStub,
  type Candidate,
  type CustomFragranceInput,
  type Fragrance,
  type SearchResponse,
} from "@/lib/schemas";

export const SEARCH_PAGE_SIZE = 20;

/**
 * Resolves a free-text name to ranked candidates. Always asks Fragrantica's
 * live search - answering from the local cache whenever it had *some*
 * match used to hide results nobody had looked up yet. Each candidate is
 * tagged with its stored id when we already have it. The cache is only a
 * fallback for when the live search is unreachable. Always returns a list;
 * callers decide how to handle 0/1/many results, never auto-picks one.
 */
export async function search(query: string, page = 0): Promise<SearchResponse> {
  try {
    const live = await searchLive(query, SEARCH_PAGE_SIZE, page);
    const ids = await fragranceRepository.getIdsByUrls(live.candidates.map((c) => c.url));
    // Custom fragrances aren't on Fragrantica, so matching ones lead the first page.
    const customs = page === 0 ? await fragranceRepository.searchCustomByName(query, 5) : [];
    return {
      source: "live_search",
      candidates: [
        ...customs.map((f) => ({ name: f.name, brand: f.brand, url: f.url, id: f.id ?? null })),
        ...live.candidates.map((c) => ({ ...c, id: ids.get(c.url) ?? null })),
      ],
      page: live.page,
      totalPages: live.totalPages,
      totalHits: live.totalHits,
    };
  } catch {
    // Fallback is a single page of cached matches - there's no paging to offer.
    const cacheHits = await fragranceRepository.searchByName(query, SEARCH_PAGE_SIZE);
    const fragrances = await fragranceRepository.getByIds(cacheHits.map((h) => h.id));
    const candidates: Candidate[] = fragrances.map((f) => ({ name: f.name, brand: f.brand, url: f.url, id: f.id ?? null }));
    return { source: "cache", candidates, page: 0, totalPages: 1, totalHits: candidates.length };
  }
}

// One fetch per url at a time within this process - quick add's background
// completion and a user expanding the same result shouldn't both scrape it.
const inFlight = new Map<string, Promise<Fragrance>>();

/**
 * Resolves a single fragrance by URL: cache read if we already have its
 * details, otherwise fetch + parse + store (filling in a stub if there is
 * one - same row, same id), then return the stored record.
 */
export async function lookupByUrl(url: string): Promise<Fragrance> {
  const existing = await fragranceRepository.getByUrl(url);
  if (existing && !isStub(existing)) return existing;

  const pending = inFlight.get(url);
  if (pending) return pending;

  const work = (async () => {
    const { html } = await fetchPage(url);
    const parsed = parseFragrancePage(html, url);
    const id = await fragranceRepository.upsert(parsed);
    return { ...parsed, id };
  })().finally(() => inFlight.delete(url));
  inFlight.set(url, work);
  return work;
}

/**
 * Instant half of "quick add": makes sure the fragrance has a stored row
 * (a stub if it's new) so it can go into a collection immediately.
 * `needsDetails` tells the caller to schedule lookupByUrl in the background.
 */
export async function ensureStored(candidate: Candidate): Promise<{ fragrance: Fragrance; needsDetails: boolean }> {
  const fragrance = await fragranceRepository.insertStub(candidate);
  return { fragrance, needsDetails: isStub(fragrance) };
}

/** Stores a user-created fragrance (nothing to scrape - its details are what the user entered). */
export async function createCustom(input: CustomFragranceInput): Promise<Fragrance> {
  const fragrance: Omit<Fragrance, "id"> = {
    name: input.name,
    brand: input.brand || "Custom",
    url: `${CUSTOM_URL_PREFIX}${crypto.randomUUID()}`,
    notesTop: input.notesTop,
    notesMiddle: input.notesMiddle,
    notesBase: input.notesBase,
    accords: [...input.accords].sort((a, b) => b.strength - a.strength),
    rating: null,
    ratingCount: null,
    votes: null,
    perfumer: null,
    description: input.description || null,
    imageUrl: input.imageUrl ?? null,
    scrapedAt: new Date().toISOString(),
  };
  const id = await fragranceRepository.upsert(fragrance);
  return { ...fragrance, id };
}

export async function lookupById(id: number): Promise<Fragrance | null> {
  return fragranceRepository.getById(id);
}
