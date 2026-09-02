import { z } from "zod";

export const AccordSchema = z.object({
  name: z.string(),
  strength: z.number(), // 0-100, from the accord bar's width%
});
export type Accord = z.infer<typeof AccordSchema>;

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
  longevity: z.string().nullable(),
  sillage: z.string().nullable(),
  perfumer: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  scrapedAt: z.string(), // ISO8601
});
export type Fragrance = z.infer<typeof FragranceSchema>;

export const CandidateSchema = z.object({
  name: z.string(),
  brand: z.string(),
  url: z.string().url(),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const SearchResponseSchema = z.object({
  source: z.enum(["cache", "live_search"]),
  candidates: z.array(CandidateSchema),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
