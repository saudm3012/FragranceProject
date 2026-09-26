import { NextRequest, NextResponse } from "next/server";
import { ProfilesBodySchema } from "@/lib/intelliscent/requestSchemas";
import type { ProfilesRequest } from "@/lib/intelliscent/types";
import { profiles } from "@/lib/services/intelliscentService";

/** Estimated and effective (overrides applied) profiles for the given fragrances - backs the profile editor. */
export async function POST(req: NextRequest) {
  const parsed = ProfilesBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  return NextResponse.json(await profiles(parsed.data as ProfilesRequest));
}
