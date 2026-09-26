import { NextRequest, NextResponse } from "next/server";
import { SuggestBodySchema } from "@/lib/intelliscent/requestSchemas";
import type { SuggestRequest } from "@/lib/intelliscent/types";
import { IntelliScentInputError, suggest } from "@/lib/services/intelliscentService";

export async function POST(req: NextRequest) {
  const parsed = SuggestBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    return NextResponse.json(await suggest(parsed.data as unknown as SuggestRequest));
  } catch (err) {
    if (err instanceof IntelliScentInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
