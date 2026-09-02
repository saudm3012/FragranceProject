import { fetchMany } from "@/lib/scraping/fetch";
import { parseFragrancePage } from "@/lib/scraping/parse";
import * as fragranceRepository from "@/lib/fragranceRepository";
import * as collectionRepository from "@/lib/collectionRepository";
import type { CollectionEntry } from "@/lib/collectionRepository";

export async function list(): Promise<CollectionEntry[]> {
  return collectionRepository.list();
}

export async function add(fragranceId: number): Promise<void> {
  await collectionRepository.add(fragranceId);
}

export async function remove(collectionId: number): Promise<void> {
  await collectionRepository.remove(collectionId);
}

/**
 * Re-fetches + re-parses every fragrance currently in the collection, with
 * bounded concurrency, updating each cache row in place. A personal
 * collection is small (tens to low hundreds), so this is a normal
 * user-triggered action, not a crawl.
 */
export async function refresh(): Promise<{ refreshed: number; failed: number }> {
  const urls = await collectionRepository.listUrls();
  const results = await fetchMany(urls, 4);

  let refreshed = 0;
  let failed = 0;
  for (const result of results) {
    if ("error" in result) {
      failed++;
      continue;
    }
    const parsed = parseFragrancePage(result.html, result.url);
    await fragranceRepository.upsert(parsed);
    refreshed++;
  }

  return { refreshed, failed };
}
