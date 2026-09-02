import { NextResponse } from "next/server";
import * as fragranceRepository from "@/lib/fragranceRepository";

/** Every cached fragrance - backs the /db debug/browse page. */
export async function GET() {
  const fragrances = await fragranceRepository.listAll();
  return NextResponse.json(fragrances);
}
