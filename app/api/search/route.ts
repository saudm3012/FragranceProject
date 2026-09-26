import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/services/lookupService";

/** GET /api/search?q=<name>&page=<0-based page> */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: "Missing required query param 'q'" }, { status: 400 });
  }
  const page = Number(req.nextUrl.searchParams.get("page") ?? 0);
  if (!Number.isInteger(page) || page < 0) {
    return NextResponse.json({ error: "page must be a non-negative integer" }, { status: 400 });
  }

  return NextResponse.json(await search(q.trim(), page));
}
