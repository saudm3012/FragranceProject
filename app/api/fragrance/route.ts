import { NextRequest, NextResponse } from "next/server";
import { lookupByUrl } from "@/lib/services/lookupService";

// Headless-Chromium fetches take a few seconds (real browser launch + page
// load + possibly waiting out Cloudflare's challenge) - default serverless
// timeouts are too tight for that.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing required query param 'url'" }, { status: 400 });
  }
  if (!url.startsWith("https://www.fragrantica.com/")) {
    return NextResponse.json({ error: "url must be a fragrantica.com perfume page" }, { status: 400 });
  }

  try {
    const fragrance = await lookupByUrl(url);
    return NextResponse.json(fragrance);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
