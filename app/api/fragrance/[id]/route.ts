import { NextResponse } from "next/server";
import { lookupById } from "@/lib/services/lookupService";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "id must be an integer" }, { status: 400 });
  }

  const fragrance = await lookupById(idNum);
  if (!fragrance) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(fragrance);
}
