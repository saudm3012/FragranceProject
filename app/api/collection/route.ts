import { NextRequest, NextResponse } from "next/server";
import * as collectionService from "@/lib/services/collectionService";

export async function GET() {
  const entries = await collectionService.list();
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fragranceId = body?.fragrance_id;
  if (!Number.isInteger(fragranceId)) {
    return NextResponse.json({ error: "Body must include integer fragrance_id" }, { status: 400 });
  }

  await collectionService.add(fragranceId);
  return NextResponse.json({ ok: true }, { status: 201 });
}
