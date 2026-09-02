import { NextResponse } from "next/server";
import * as collectionService from "@/lib/services/collectionService";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "id must be an integer" }, { status: 400 });
  }

  await collectionService.remove(idNum);
  return NextResponse.json({ ok: true });
}
