// Fetches a single Fragrantica page's fully-rendered HTML via headless
// Chromium - plain fetch() cannot get past Fragrantica's Cloudflare JS
// challenge (confirmed in Stage 0 - it returns a "Just a moment..."
// interactive challenge, not a static block). See browser.ts for the shared
// launcher this and search.ts both use.

import { newContext } from "@/lib/scraping/browser";

const NAV_TIMEOUT_MS = 30_000;
// Upper bound on how long to wait for Cloudflare's challenge to clear -
// polled (see below) rather than always slept in full, since the challenge
// usually resolves well under this.
const CHALLENGE_MAX_WAIT_MS = 8_000;
const CHALLENGE_POLL_MS = 250;
// The community vote widgets (longevity / sillage / when-to-wear) are
// rendered by the page's own JS after load. Wait for them, bounded - a
// low-vote fragrance may never render them, and that's fine.
const VOTES_MAX_WAIT_MS = 10_000;

export interface FetchResult {
  url: string;
  status: number;
  html: string;
}

export interface FetchError {
  url: string;
  error: string;
}

/** Fetch a single page's fully-rendered HTML, waiting out Cloudflare's challenge if present. */
export async function fetchPage(url: string): Promise<FetchResult> {
  const context = await newContext();
  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });

    // If Cloudflare's interactive challenge is showing, poll for it to clear
    // instead of always sleeping the full max wait - it usually resolves in
    // well under a second once solved, so this saves real time on the
    // common case while still bounding the worst case.
    const title = await page.title();
    if (title.toLowerCase().includes("just a moment")) {
      await page
        .waitForFunction(() => !document.title.toLowerCase().includes("just a moment"), undefined, {
          timeout: CHALLENGE_MAX_WAIT_MS,
          polling: CHALLENGE_POLL_MS,
        })
        .catch(() => {}); // proceed with whatever's rendered if it never clears in time
    }

    // Scroll part-way so any lazily-mounted widgets start, then wait until the
    // longevity label and the season widget both exist as real elements
    // (matched by exact span text, so review prose mentioning "longevity"
    // doesn't count).
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.3)).catch(() => {});
    await page
      .waitForFunction(
        () => {
          const spanTexts = new Set(
            Array.from(document.querySelectorAll("span"), (s) => (s.textContent ?? "").trim().toLowerCase())
          );
          return spanTexts.has("longevity") && spanTexts.has("winter");
        },
        undefined,
        { timeout: VOTES_MAX_WAIT_MS, polling: CHALLENGE_POLL_MS }
      )
      .catch(() => {}); // no vote widgets - parse whatever's there

    const html = await page.content();
    return { url, status: response?.status() ?? 0, html };
  } finally {
    await context.close();
  }
}

/**
 * Fetch many URLs with bounded concurrency (default 4 pages at once, sharing
 * one launched browser). Each result is either a success or an error - never
 * throws for an individual URL failure, so one bad page doesn't kill the batch.
 */
export async function fetchMany(
  urls: string[],
  maxConcurrency = 4
): Promise<Array<FetchResult | FetchError>> {
  const results: Array<FetchResult | FetchError> = new Array(urls.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= urls.length) return;
      try {
        results[i] = await fetchPage(urls[i]);
      } catch (err) {
        results[i] = { url: urls[i], error: err instanceof Error ? err.message : String(err) };
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
