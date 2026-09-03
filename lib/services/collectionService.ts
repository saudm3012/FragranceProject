import { fetchMany } from "@/lib/scraping/fetch";
import { parseFragrancePage } from "@/lib/scraping/parse";
import * as fragranceRepository from "@/lib/fragranceRepository";

/**
 * Re-fetches + re-parses the given fragrances (by id), with bounded
 * concurrency, updating each cache row in place. Which fragrances make up
 * "the collection" is tracked client-side (localStorage, see
 * lib/client/localCollection.ts) rather than server-side, so the caller
 * supplies the ids - this just refreshes whatever it's given. A personal
 * collection is small (tens to low hundreds), so this is a normal
 * user-triggered action, not a crawl.
 */
export async function refresh(fragranceIds: number[]): Promise<{ refreshed: number; failed: number }> {
  const fragrances = await fragranceRepository.getByIds(fragranceIds);
  const results = await fetchMany(
    fragrances.map((f) => f.url),
    4
  );

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
