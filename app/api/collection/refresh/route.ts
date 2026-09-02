import { NextResponse } from "next/server";
import * as collectionService from "@/lib/services/collectionService";

// Vercel Hobby plan caps functions at 60s regardless of what's set here.
// At concurrency=4 and ~3-5s per headless fetch, that's roughly 50-80
// fragrances refreshable per call before timing out - fine for the
// expected personal-collection scale, but a real ceiling worth knowing
// about; chunking a "refresh" into multiple calls is a v2 concern, not v1.
export const maxDuration = 60;

export async function POST() {
  const result = await collectionService.refresh();
  return NextResponse.json(result);
}
