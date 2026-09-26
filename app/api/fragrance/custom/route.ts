import { NextRequest, NextResponse } from "next/server";
import { KNOWN_ACCORDS } from "@/lib/intelliscent/derive/accordMap";
import { CustomFragranceSchema } from "@/lib/schemas";
import { createCustom } from "@/lib/services/lookupService";

/**
 * POST a user-created fragrance (one that isn't on Fragrantica, or a
 * personal blend). Stored like any other fragrance; returns the record.
 */
export async function POST(req: NextRequest) {
  const parsed = CustomFragranceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  // Accords must be ones IntelliScent can score; anything else would silently count for nothing.
  const unknown = parsed.data.accords.map((a) => a.name.toLowerCase()).filter((n) => !KNOWN_ACCORDS.includes(n));
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown accord(s): ${unknown.join(", ")}` }, { status: 400 });
  }
  const accords = parsed.data.accords.map((a) => ({ ...a, name: a.name.toLowerCase() }));
  return NextResponse.json(await createCustom({ ...parsed.data, accords }), { status: 201 });
}
