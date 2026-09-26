// Server side of IntelliScent: load fragrances, turn them into profiles
// (estimated, then the caller's hand overrides on top), and run the engine
// with the caller's settings and personal layer. All per-user state arrives
// in the request - nothing user-specific is stored server-side yet.

import * as fragranceRepository from "@/lib/fragranceRepository";
import { applyCheckins } from "@/lib/intelliscent/checkins";
import { CURATED_CLASHES, fragranticaPath } from "@/lib/intelliscent/clashList";
import { deriveProfile } from "@/lib/intelliscent/derive/deriveProfile";
import {
  buildEngineContext,
  buildRecipe,
  scoreCombo,
  suggest as engineSuggest,
  type PersonalLayer,
  type SuggestStats,
} from "@/lib/intelliscent/engine";
import { applyOverride, sanitizeOverride, type FragranceProfile } from "@/lib/intelliscent/profile";
import { normalizeSettings } from "@/lib/intelliscent/settings";
import type {
  ComboResult,
  EnginePayload,
  ProfilesRequest,
  ProfilesResponse,
  RateRequest,
  RateResponse,
  SuggestRequest,
  SuggestResponse,
} from "@/lib/intelliscent/types";
import { isStub, type Fragrance } from "@/lib/schemas";

export class IntelliScentInputError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Quick-added fragrances are stubs until their details arrive - scoring them would treat them as scentless. */
function stillLoading(stubs: Fragrance[]): IntelliScentInputError {
  return new IntelliScentInputError(
    `Details for ${stubs.map((f) => f.name).join(", ")} are still loading - try again in a few seconds.`,
    409
  );
}

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;

type StoredFragrance = Fragrance & { id: number };

// Estimation is deterministic per scraped record, so cache it until the row is re-scraped.
const estimateCache = new Map<number, { scrapedAt: string; profile: FragranceProfile }>();

function estimated(f: StoredFragrance): FragranceProfile {
  const hit = estimateCache.get(f.id);
  if (hit && hit.scrapedAt === f.scrapedAt) return hit.profile;
  const profile = deriveProfile(f);
  estimateCache.set(f.id, { scrapedAt: f.scrapedAt, profile });
  return profile;
}

/** Estimate -> the user's post-wear check-ins -> their hand edits (each layer wins over the one before). */
function effective(f: StoredFragrance, input: Pick<EnginePayload, "overrides" | "checkins">): FragranceProfile {
  const withCheckins = applyCheckins(estimated(f), input.checkins?.[String(f.id)]);
  const override = input.overrides?.[String(f.id)];
  return override ? applyOverride(withCheckins, sanitizeOverride(override)) : withCheckins;
}

function stored(fragrances: Fragrance[]): StoredFragrance[] {
  return fragrances.filter((f): f is StoredFragrance => f.id != null);
}

function sanitizePersonal(input: unknown): PersonalLayer | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const matrixOverrides: Record<string, number> = {};
  if (p.matrixOverrides && typeof p.matrixOverrides === "object") {
    for (const [k, v] of Object.entries(p.matrixOverrides as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) matrixOverrides[k] = Math.max(-1, Math.min(1, v));
    }
  }
  const hardAvoid = Array.isArray(p.hardAvoid) ? p.hardAvoid.filter((x): x is string => typeof x === "string") : [];
  return { matrixOverrides, hardAvoid };
}

function curatedClashPairs(fragrances: StoredFragrance[]): Array<[number, number]> {
  const byPath = new Map(fragrances.map((f) => [fragranticaPath(f.url), f.id]));
  return CURATED_CLASHES.flatMap((c): Array<[number, number]> => {
    const a = byPath.get(c.a);
    const b = byPath.get(c.b);
    return a != null && b != null ? [[a, b]] : [];
  });
}

function engineContext(payload: EnginePayload, fragrances: StoredFragrance[]) {
  return buildEngineContext({
    settings: normalizeSettings(payload.settings),
    personal: sanitizePersonal(payload.personal),
    clashPairs: [...curatedClashPairs(fragrances), ...(payload.clashPairs ?? [])],
  });
}

function nameLookup(fragrances: StoredFragrance[]) {
  const names = new Map(fragrances.map((f) => [f.id, f.name]));
  return (p: FragranceProfile) => names.get(p.fragranceId) ?? `#${p.fragranceId}`;
}

const SWEET_POOL_SHARE = 0.5;

/**
 * Pool-level observations worth telling the user. A sweetness cap that
 * fires on most pairs isn't a bug to tune away - it's telling the user
 * their bottles mostly need a non-sweet partner rather than each other.
 */
function insightsFrom(stats: SuggestStats): string[] {
  const insights: string[] = [];
  if (stats.pairsScored >= 4 && stats.sweetnessTripped / stats.pairsScored >= SWEET_POOL_SHARE) {
    const pct = Math.round((100 * stats.sweetnessTripped) / stats.pairsScored);
    insights.push(
      `${pct}% of these pairings are too sweet together - these bottles mostly want a non-sweet partner (citrus, green, aromatic or woody) rather than each other.`
    );
  }
  return insights;
}

export async function suggest(input: SuggestRequest): Promise<SuggestResponse> {
  let base: StoredFragrance | null = null;
  if (input.baseId != null) {
    const found = await fragranceRepository.getById(input.baseId);
    if (!found || found.id == null) throw new IntelliScentInputError(`Fragrance ${input.baseId} not found`, 404);
    if (isStub(found)) throw stillLoading([found]);
    base = found as StoredFragrance;
  }

  // Loads the whole cache when no pool is given. Fine at today's size; once
  // the full-catalog crawl lands this wants precomputed, stored profiles.
  const loaded = input.poolIds
    ? await fragranceRepository.getByIds(input.poolIds)
    : await fragranceRepository.listAll();
  const pool = stored(loaded).filter((f) => f.accords.length > 0 && f.id !== base?.id);
  const everything = base ? [base, ...pool] : pool;

  const ctx = engineContext(input, everything);
  const nameOf = nameLookup(everything);
  const profiles = new Map(everything.map((f) => [f.id, effective(f, input)]));

  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));
  const { results: combos, stats } = engineSuggest({
    base: base ? profiles.get(base.id)! : null,
    pool: pool.map((f) => profiles.get(f.id)!),
    ctx,
    limit,
    nameOf,
  });

  const results: ComboResult[] = combos.map((c) => ({ ...c, recipe: buildRecipe(c, profiles, ctx.settings) }));
  const referenced = new Set(results.flatMap((r) => r.fragranceIds));
  return {
    poolSize: pool.length,
    results,
    fragrances: everything.filter((f) => referenced.has(f.id)),
    insights: insightsFrom(stats),
  };
}

export async function rate(input: RateRequest): Promise<RateResponse> {
  const settings = normalizeSettings(input.settings);
  const ids = [...new Set(input.fragranceIds)];
  if (ids.length < 2) throw new IntelliScentInputError("A combo needs at least 2 different fragrances");
  if (ids.length > settings.maxComboSize) {
    throw new IntelliScentInputError(
      settings.maxComboSize === 3
        ? "Combos are capped at 3 scents - enable experimental 4-scent combos in Advanced settings to go further."
        : "Combos are capped at 4 scents."
    );
  }

  const fragrances = stored(await fragranceRepository.getByIds(ids));
  if (fragrances.length !== ids.length) {
    const found = new Set(fragrances.map((f) => f.id));
    throw new IntelliScentInputError(`Fragrance(s) not found: ${ids.filter((id) => !found.has(id)).join(", ")}`, 404);
  }
  const stubs = fragrances.filter(isStub);
  if (stubs.length > 0) throw stillLoading(stubs);

  const ctx = engineContext(input, fragrances);
  const profiles = new Map(fragrances.map((f) => [f.id, effective(f, input)]));
  const combo = scoreCombo(ids.map((id) => profiles.get(id)!), ctx, nameLookup(fragrances));
  return { result: { ...combo, recipe: buildRecipe(combo, profiles, ctx.settings) }, fragrances };
}

export async function profiles(input: ProfilesRequest): Promise<ProfilesResponse> {
  const fragrances = stored(await fragranceRepository.getByIds([...new Set(input.ids)]));
  return {
    profiles: fragrances.map((f) => ({
      estimated: estimated(f),
      effective: effective(f, input),
    })),
  };
}
