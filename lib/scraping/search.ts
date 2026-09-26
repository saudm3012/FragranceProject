// Fragrantica's search box is backed by Algolia, called directly from the
// browser with a public, search-scoped API key (confirmed by intercepting
// the request Fragrantica's own frontend makes). That key is short-lived -
// it's an Algolia "secured API key" with a `validUntil` timestamp baked into
// it (observed ~3 weeks out from when this was written) - so it can't be
// hardcoded. Extraction (a real page load - the only place this module
// needs Playwright) takes ~15-30s, so it's cached two levels deep:
//   1. In-memory, for reuse within one warm process/instance.
//   2. In Turso, so a *different* cold serverless instance doesn't have to
//      pay the extraction cost again - without this, every Vercel cold
//      start was silently repeating the full ~15-30s extraction, which is
//      why searches could feel slow in production even though the actual
//      per-query Algolia call (once credentials exist) is sub-second.
// Both caches are checked before falling back to a live extraction, and a
// fresh extraction updates both.

import { getBrowser } from "@/lib/scraping/browser";
import * as algoliaCredentialsRepository from "@/lib/algoliaCredentialsRepository";
import type { Candidate } from "@/lib/schemas";

type AlgoliaCredentials = algoliaCredentialsRepository.AlgoliaCredentials;

let cached: AlgoliaCredentials | null = null;
let inFlightExtraction: Promise<AlgoliaCredentials> | null = null;

function isFresh(credentials: AlgoliaCredentials, now: number): boolean {
  return credentials.validUntil > now + 60;
}

function decodeValidUntil(apiKey: string): number {
  try {
    const decoded = Buffer.from(apiKey, "base64").toString("utf-8");
    const match = decoded.match(/validUntil=(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

async function extractCredentials(): Promise<AlgoliaCredentials> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  });
  try {
    const page = await context.newPage();

    const found = new Promise<AlgoliaCredentials>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for Algolia request")), 15_000);
      page.on("request", (req) => {
        const url = req.url();
        if (!url.includes("algolia.net")) return;
        const appId = new URL(url).searchParams.get("x-algolia-application-id");
        const apiKey = new URL(url).searchParams.get("x-algolia-api-key");
        if (appId && apiKey) {
          clearTimeout(timeout);
          resolve({ appId, apiKey, validUntil: decodeValidUntil(apiKey) });
        }
      });
    });

    await page.goto("https://www.fragrantica.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1_500); // let the page settle before probing for the search toggle
    const searchToggle = page
      .locator("button:has-text('Search'), [aria-label*=search i], svg[class*=search]")
      .first();
    await searchToggle.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500); // reveal animation for the input
    const input = page
      .locator("input[type=search], input[placeholder*=Search i], input[name*=search i]")
      .first();
    await input.fill("a", { timeout: 10_000 });

    return await found;
  } finally {
    await context.close();
  }
}

async function getCredentials(forceRefresh = false): Promise<AlgoliaCredentials> {
  const now = Date.now() / 1000;
  if (!forceRefresh && cached && isFresh(cached, now)) return cached;

  if (!forceRefresh) {
    const stored = await algoliaCredentialsRepository.get();
    if (stored && isFresh(stored, now)) {
      cached = stored;
      return cached;
    }
  }

  // Concurrent callers (e.g. two near-simultaneous searches on a cold cache)
  // should share one extraction, not each launch their own browser.
  if (!inFlightExtraction) {
    inFlightExtraction = extractCredentials()
      .then(async (creds) => {
        await algoliaCredentialsRepository.upsert(creds);
        return creds;
      })
      .finally(() => {
        inFlightExtraction = null;
      });
  }
  cached = await inFlightExtraction;
  return cached;
}

interface AlgoliaHit {
  objectID: string;
  id: number;
  naslov: string; // fragrance name
  dizajner: string; // brand
  slug: string; // e.g. "Creed/Aventus" -> maps to /perfume/{slug}-{id}.html
}

interface AlgoliaResult {
  hits: AlgoliaHit[];
  nbHits: number;
  nbPages: number;
  page: number;
}

async function queryAlgolia(
  credentials: AlgoliaCredentials,
  query: string,
  limit: number,
  page: number
): Promise<AlgoliaResult> {
  const host = `${credentials.appId.toLowerCase()}-dsn.algolia.net`;
  const res = await fetch(`https://${host}/1/indexes/*/queries`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-algolia-api-key": credentials.apiKey,
      "x-algolia-application-id": credentials.appId,
    },
    body: JSON.stringify({
      requests: [
        {
          indexName: "fragrantica_perfumes",
          query,
          params: `hitsPerPage=${limit}&page=${page}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Algolia search failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { results: AlgoliaResult[] };
  return body.results[0] ?? { hits: [], nbHits: 0, nbPages: 0, page };
}

export interface LiveSearchPage {
  candidates: Candidate[];
  page: number; // 0-based
  totalPages: number;
  totalHits: number;
}

/** Searches Fragrantica's live Algolia index for a fragrance name, one page at a time (page is 0-based). */
export async function searchLive(query: string, limit = 10, page = 0): Promise<LiveSearchPage> {
  let credentials = await getCredentials();
  let result: AlgoliaResult;
  try {
    result = await queryAlgolia(credentials, query, limit, page);
  } catch {
    // Credentials may have been rejected (expired early, revoked) - force a
    // fresh extraction once (bypassing both caches, since Turso would just
    // hand back the same rejected key) and retry before giving up.
    cached = null;
    credentials = await getCredentials(true);
    result = await queryAlgolia(credentials, query, limit, page);
  }

  return {
    candidates: result.hits.map((hit) => ({
      name: hit.naslov,
      brand: hit.dizajner,
      url: `https://www.fragrantica.com/perfume/${hit.slug}-${hit.id}.html`,
    })),
    page: result.page,
    totalPages: result.nbPages,
    totalHits: result.nbHits,
  };
}
