import { after, NextRequest, NextResponse } from "next/server";
import { CandidateSchema } from "@/lib/schemas";
import { ensureStored, lookupByUrl } from "@/lib/services/lookupService";

// The background detail fetch (headless Chromium, a few seconds) runs in
// after() and is bound by this route's max duration.
export const maxDuration = 60;

/**
 * POST { name, brand, url } -> the stored fragrance, immediately. New
 * fragrances come back as a stub (details pending) and their page is
 * fetched after the response is sent, so "add to collection" never waits
 * on Fragrantica.
 */
export async function POST(req: NextRequest) {
  const parsed = CandidateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  if (!parsed.data.url.startsWith("https://www.fragrantica.com/")) {
    return NextResponse.json({ error: "url must be a fragrantica.com perfume page" }, { status: 400 });
  }

  const { fragrance, needsDetails } = await ensureStored(parsed.data);
  if (needsDetails) {
    after(async () => {
      // The stub stays in place if this fails; the next lookup or refresh fills it in.
      await lookupByUrl(parsed.data.url).catch(() => {});
    });
  }
  return NextResponse.json(fragrance);
}
