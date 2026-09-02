import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/services/lookupService";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: "Missing required query param 'q'" }, { status: 400 });
  }

  const result = await search(q.trim());
  return NextResponse.json(result);
}
