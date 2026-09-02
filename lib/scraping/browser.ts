// Shared headless-Chromium launcher, used by both fetch.ts (fetching pages)
// and search.ts (one-time Algolia credential extraction). Two environments,
// one Browser type:
//   - Local dev / external crawl script: full `playwright` package, uses its
//     own locally-installed Chromium (see `npx playwright install chromium`).
//   - Vercel serverless functions: `playwright-core` (no bundled browser,
//     keeps the function small) driving the binary `@sparticuz/chromium`
//     provides at runtime.
//
// A single Browser instance is reused across calls within the same process
// (module-level singleton) - launching is the expensive part, not opening a
// new page/context in an already-running browser.

import type { Browser, BrowserContext } from "playwright-core";

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;

  browserPromise = (async () => {
    if (process.env.VERCEL) {
      const chromium = (await import("@sparticuz/chromium")).default;
      const { chromium: playwrightChromium } = await import("playwright-core");
      return playwrightChromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    }

    const { chromium } = await import("playwright");
    return chromium.launch({ headless: true });
  })();

  return browserPromise;
}

export async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });
}
