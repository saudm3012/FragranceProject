// Fragrantica's search box is backed by Algolia, called directly from the
// browser with a public, search-scoped API key (confirmed by intercepting
// the request Fragrantica's own frontend makes). That key is short-lived -
// it's an Algolia "secured API key" with a `validUntil` timestamp baked into
// it (observed ~3 weeks out from when this was written) - so it can't be
// hardcoded. Instead: extract it once via a real page load (the only place
// we need Playwright here), cache it in memory, and re-extract when it's
// gone or Algolia rejects it. Actual search queries then go straight to
// Algolia with plain fetch() - fast, and never touches Fragrantica's own
// Cloudflare-protected domain at all.

import { getBrowser } from "@/lib/scraping/browser";
import type { Candidate } from "@/lib/schemas";

interface AlgoliaCredentials {
  appId: string;
  apiKey: string;
  validUntil: number; // unix seconds
}

let cached: AlgoliaCredentials | null = null;
let inFlightExtraction: Promise<AlgoliaCredentials> | null = null;

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

async function getCredentials(): Promise<AlgoliaCredentials> {
  const now = Date.now() / 1000;
  if (cached && cached.validUntil > now + 60) return cached;

  // Concurrent callers (e.g. two near-simultaneous searches on a cold cache)
  // should share one extraction, not each launch their own browser.
  if (!inFlightExtraction) {
    inFlightExtraction = extractCredentials().finally(() => {
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

async function queryAlgolia(credentials: AlgoliaCredentials, query: string, limit: number) {
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
          params: `hitsPerPage=${limit}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Algolia search failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { results: Array<{ hits: AlgoliaHit[] }> };
  return body.results[0]?.hits ?? [];
}

/** Searches Fragrantica's live Algolia index for a fragrance name. */
export async function searchLive(query: string, limit = 10): Promise<Candidate[]> {
  let credentials = await getCredentials();
  let hits: AlgoliaHit[];
  try {
    hits = await queryAlgolia(credentials, query, limit);
  } catch {
    // Credentials may have been rejected (expired early, revoked) - force a
    // fresh extraction once and retry before giving up.
    cached = null;
    credentials = await getCredentials();
    hits = await queryAlgolia(credentials, query, limit);
  }

  return hits.map((hit) => ({
    name: hit.naslov,
    brand: hit.dizajner,
    url: `https://www.fragrantica.com/perfume/${hit.slug}-${hit.id}.html`,
  }));
}
