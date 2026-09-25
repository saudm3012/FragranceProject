import * as fragranceRepository from "@/lib/fragranceRepository";
import { activeAlgorithm } from "@/lib/intelliscent";
import { normalizeParams } from "@/lib/intelliscent/params";
import type { RateResponse, SuggestResponse } from "@/lib/intelliscent/types";

export class IntelliScentInputError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function suggest(input: {
  fragranceId: number;
  params: unknown;
  poolIds?: number[];
  limit?: number;
}): Promise<SuggestResponse> {
  const params = normalizeParams(input.params);
  const base = await fragranceRepository.getById(input.fragranceId);
  if (!base) throw new IntelliScentInputError(`Fragrance ${input.fragranceId} not found`, 404);

  // Loads the whole cache as the candidate pool. Fine at today's size; once
  // the full-catalog crawl lands (~100k rows) this should move to
  // precomputed accord vectors rather than parsing every row per request.
  const candidates = input.poolIds
    ? await fragranceRepository.getByIds(input.poolIds)
    : await fragranceRepository.listAll();
  const pool = candidates.filter((f) => f.id != null && f.id !== base.id && f.accords.length > 0);

  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));
  const ranked = activeAlgorithm.suggest(base, pool, params, limit);
  const byId = new Map(pool.map((f) => [f.id!, f]));

  return {
    algorithm: activeAlgorithm.info,
    params,
    poolSize: pool.length,
    suggestions: ranked.flatMap((s) => {
      const fragrance = byId.get(s.fragranceId);
      return fragrance ? [{ ...s, fragrance }] : [];
    }),
  };
}

export async function rate(input: { fragranceIds: number[]; params: unknown }): Promise<RateResponse> {
  const ids = [...new Set(input.fragranceIds)];
  if (ids.length < 2) throw new IntelliScentInputError("A combo needs at least 2 different fragrances");

  const params = normalizeParams(input.params);
  const fragrances = await fragranceRepository.getByIds(ids);
  if (fragrances.length !== ids.length) {
    const found = new Set(fragrances.map((f) => f.id));
    const missing = ids.filter((id) => !found.has(id));
    throw new IntelliScentInputError(`Fragrance(s) not found: ${missing.join(", ")}`, 404);
  }

  return { algorithm: activeAlgorithm.info, params, rating: activeAlgorithm.rateCombo(fragrances, params) };
}
