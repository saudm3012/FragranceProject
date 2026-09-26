import { NextRequest, NextResponse } from "next/server";
import { RateBodySchema } from "@/lib/intelliscent/requestSchemas";
import type { RateRequest } from "@/lib/intelliscent/types";
import { IntelliScentInputError, rate } from "@/lib/services/intelliscentService";

export async function POST(req: NextRequest) {
  const parsed = RateBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    return NextResponse.json(await rate(parsed.data as unknown as RateRequest));
  } catch (err) {
    if (err instanceof IntelliScentInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
