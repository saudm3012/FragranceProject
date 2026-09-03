import { NextRequest, NextResponse } from "next/server";
import * as collectionService from "@/lib/services/collectionService";

// Vercel Hobby plan caps functions at 60s regardless of what's set here.
// At concurrency=4 and ~3-5s per headless fetch, that's roughly 50-80
// fragrances refreshable per call before timing out - fine for the
// expected personal-collection scale, but a real ceiling worth knowing
// about; chunking a "refresh" into multiple calls is a v2 concern, not v1.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fragranceIds = body?.fragrance_ids;
  if (!Array.isArray(fragranceIds) || !fragranceIds.every((n) => Number.isInteger(n))) {
    return NextResponse.json({ error: "Body must include integer array fragrance_ids" }, { status: 400 });
  }

  const result = await collectionService.refresh(fragranceIds);
  return NextResponse.json(result);
}
