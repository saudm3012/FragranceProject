import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { IntelliScentInputError, suggest } from "@/lib/services/intelliscentService";

// params is validated loosely here and normalized against the param
// registry in the service, so adding/removing params never needs a change here.
const BodySchema = z.object({
  fragranceId: z.number().int(),
  params: z.record(z.string(), z.number()).default({}),
  poolIds: z.array(z.number().int()).optional(),
  limit: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    return NextResponse.json(await suggest(parsed.data));
  } catch (err) {
    if (err instanceof IntelliScentInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
