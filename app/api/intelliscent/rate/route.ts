import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { IntelliScentInputError, rate } from "@/lib/services/intelliscentService";

const BodySchema = z.object({
  fragranceIds: z.array(z.number().int()),
  params: z.record(z.string(), z.number()).default({}),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    return NextResponse.json(await rate(parsed.data));
  } catch (err) {
    if (err instanceof IntelliScentInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
