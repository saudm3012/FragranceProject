import { NextRequest, NextResponse } from "next/server";
import * as fragranceRepository from "@/lib/fragranceRepository";

/**
 * GET /api/fragrances - every cached fragrance (backs the /db browse page).
 * GET /api/fragrances?ids=1,2,3 - just those (backs the local collection
 * view, which stores only fragrance ids client-side).
 */
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids");
  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n));
    const fragrances = await fragranceRepository.getByIds(ids);
    return NextResponse.json(fragrances);
  }

  const fragrances = await fragranceRepository.listAll();
  return NextResponse.json(fragrances);
}
