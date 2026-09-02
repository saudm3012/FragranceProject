// Stage 0 throwaway route: confirms whether this deployment environment
// (local dev, or a real Vercel preview) can get past Cloudflare's challenge
// and fetch a live Fragrantica page via headless Chromium.
// Delete once Stage 0 is resolved and Stage 1's real routes exist.

import { NextResponse } from "next/server";
import { fetchPage } from "@/lib/scraping/fetch";

const TEST_URL = "https://www.fragrantica.com/perfume/Staroscent/Morava-140590.html";

export const maxDuration = 60;

export async function GET() {
  try {
    const result = await fetchPage(TEST_URL);
    const gotChallenge = result.html.toLowerCase().includes("just a moment");
    return NextResponse.json({
      url: result.url,
      status: result.status,
      bytesReceived: result.html.length,
      gotChallenge,
      snippet: result.html.slice(0, 500),
    });
  } catch (err) {
    return NextResponse.json(
      { url: TEST_URL, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
