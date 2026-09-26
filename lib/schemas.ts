import { z } from "zod";

export const AccordSchema = z.object({
  name: z.string(),
  strength: z.number(), // 0-100, from the accord bar's width%
});
export type Accord = z.infer<typeof AccordSchema>;

/** Option label -> number of community votes, e.g. { "long lasting": 10500, ... }. */
export const VoteCountsSchema = z.record(z.string(), z.number());
export type VoteCounts = z.infer<typeof VoteCountsSchema>;

/** Fragrantica's community vote widgets. Each group is null when the page shows no votes for it. */
export const CommunityVotesSchema = z.object({
  longevity: VoteCountsSchema.nullable(), // very weak / weak / moderate / long lasting / eternal
  sillage: VoteCountsSchema.nullable(), // intimate / moderate / strong / enormous
  seasons: VoteCountsSchema.nullable(), // winter / spring / summer / fall
  timeOfDay: VoteCountsSchema.nullable(), // day / night
});
export type CommunityVotes = z.infer<typeof CommunityVotesSchema>;

export const FragranceSchema = z.object({
  id: z.number().int().optional(), // absent until persisted
  name: z.string(),
  brand: z.string(),
  url: z.string().url(),
  notesTop: z.array(z.string()),
  notesMiddle: z.array(z.string()),
  notesBase: z.array(z.string()),
  accords: z.array(AccordSchema),
  rating: z.number().nullable(),
  ratingCount: z.number().int().nullable(),
  votes: CommunityVotesSchema.nullable(),
  perfumer: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  scrapedAt: z.string(), // ISO8601 when details were scraped, or "" for a stub (see isStub)
});
export type Fragrance = z.infer<typeof FragranceSchema>;

/**
 * A stub is a placeholder row (name, brand, url only) created by "quick
 * add" so a fragrance can join a collection before its page has been
 * fetched. Its details are filled in by a background fetch.
 */
export function isStub(f: Pick<Fragrance, "scrapedAt">): boolean {
  return f.scrapedAt === "";
}

/**
 * User-created fragrances (not on Fragrantica, or a personal blend) are
 * stored like any other, with a `custom:<uuid>` url instead of a
 * Fragrantica page - so nothing ever tries to scrape or refresh them.
 */
export const CUSTOM_URL_PREFIX = "custom:";

export function isCustom(f: Pick<Fragrance, "url">): boolean {
  return f.url.startsWith(CUSTOM_URL_PREFIX);
}

export const CustomFragranceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(120).default(""),
  accords: z.array(AccordSchema.extend({ name: z.string().trim().min(1).max(40), strength: z.number().min(1).max(100) })).max(15),
  notesTop: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  notesMiddle: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  notesBase: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  description: z.string().trim().max(2000).optional(),
  imageUrl: z.string().url().startsWith("https://").optional(),
});
export type CustomFragranceInput = z.infer<typeof CustomFragranceSchema>;

export const CandidateSchema = z.object({
  name: z.string(),
  brand: z.string(),
  url: z.string().url(),
  id: z.number().int().nullable().optional(), // set when this fragrance is already stored
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const SearchResponseSchema = z.object({
  source: z.enum(["cache", "live_search"]),
  candidates: z.array(CandidateSchema),
  page: z.number().int(), // 0-based
  totalPages: z.number().int(),
  totalHits: z.number().int(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
