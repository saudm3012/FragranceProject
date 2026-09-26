import fuzzysort from "fuzzysort";
import { getDb } from "@/lib/db";
import type { Fragrance } from "@/lib/schemas";

interface FragranceRow {
  id: number;
  name: string;
  brand: string;
  url: string;
  notes_top: string | null;
  notes_middle: string | null;
  notes_base: string | null;
  accords: string | null;
  rating: number | null;
  rating_count: number | null;
  votes: string | null; // JSON CommunityVotes
  perfumer: string | null;
  description: string | null;
  image_url: string | null;
  scraped_at: string;
}

function rowToFragrance(row: FragranceRow): Fragrance {
  return {
    id: row.id,
    // Rows scraped before parse.ts collapsed whitespace can hold line breaks.
    name: row.name.replace(/\s+/g, " ").trim(),
    brand: row.brand,
    url: row.url,
    notesTop: row.notes_top ? JSON.parse(row.notes_top) : [],
    notesMiddle: row.notes_middle ? JSON.parse(row.notes_middle) : [],
    notesBase: row.notes_base ? JSON.parse(row.notes_base) : [],
    accords: row.accords ? JSON.parse(row.accords) : [],
    rating: row.rating,
    ratingCount: row.rating_count,
    votes: row.votes ? JSON.parse(row.votes) : null,
    perfumer: row.perfumer,
    description: row.description,
    imageUrl: row.image_url,
    scrapedAt: row.scraped_at,
  };
}

export async function listAll(): Promise<Fragrance[]> {
  const db = getDb();
  const result = await db.execute("SELECT * FROM fragrances ORDER BY scraped_at DESC");
  return result.rows.map((r) => rowToFragrance(r as unknown as FragranceRow));
}

export async function getByUrl(url: string): Promise<Fragrance | null> {
  const db = getDb();
  const result = await db.execute({ sql: "SELECT * FROM fragrances WHERE url = ?", args: [url] });
  if (result.rows.length === 0) return null;
  return rowToFragrance(result.rows[0] as unknown as FragranceRow);
}

export async function getById(id: number): Promise<Fragrance | null> {
  const db = getDb();
  const result = await db.execute({ sql: "SELECT * FROM fragrances WHERE id = ?", args: [id] });
  if (result.rows.length === 0) return null;
  return rowToFragrance(result.rows[0] as unknown as FragranceRow);
}

export async function getByIds(ids: number[]): Promise<Fragrance[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const result = await db.execute({
    sql: `SELECT * FROM fragrances WHERE id IN (${placeholders})`,
    args: ids,
  });
  return result.rows.map((r) => rowToFragrance(r as unknown as FragranceRow));
}

/** url -> id for whichever of `urls` are already stored. */
export async function getIdsByUrls(urls: string[]): Promise<Map<string, number>> {
  if (urls.length === 0) return new Map();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, url FROM fragrances WHERE url IN (${urls.map(() => "?").join(",")})`,
    args: urls,
  });
  return new Map(result.rows.map((r) => [r.url as string, r.id as number]));
}

/**
 * Stores a stub (see isStub in schemas.ts) for a fragrance that isn't
 * stored yet, and returns the row - an existing full record is left
 * untouched and returned as-is.
 */
export async function insertStub(candidate: { name: string; brand: string; url: string }): Promise<Fragrance> {
  const db = getDb();
  await db.execute({
    sql: `
      INSERT INTO fragrances (name, brand, url, notes_top, notes_middle, notes_base, accords, scraped_at)
      VALUES (?, ?, ?, '[]', '[]', '[]', '[]', '')
      ON CONFLICT(url) DO NOTHING
    `,
    args: [candidate.name, candidate.brand, candidate.url],
  });
  return (await getByUrl(candidate.url))!;
}

/** Every fragrance's id/name/brand - the pool fuzzy name search runs over. */
export async function listNameIndex(): Promise<Array<{ id: number; name: string; brand: string }>> {
  const db = getDb();
  const result = await db.execute("SELECT id, name, brand FROM fragrances");
  return result.rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    brand: r.brand as string,
  }));
}

/** Fuzzy-matches a free-text query against cached fragrance name+brand. */
export async function searchByName(
  query: string,
  limit = 10
): Promise<Array<{ id: number; name: string; brand: string }>> {
  const index = await listNameIndex();
  const prepared = index.map((f) => ({ ...f, target: `${f.name} ${f.brand}` }));
  const results = fuzzysort.go(query, prepared, { key: "target", limit });
  return results.map((r) => ({ id: r.obj.id, name: r.obj.name, brand: r.obj.brand }));
}

/** Insert or update a fragrance by its (unique) url. Returns the row's id. */
export async function upsert(fragrance: Omit<Fragrance, "id">): Promise<number> {
  const db = getDb();
  await db.execute({
    sql: `
      INSERT INTO fragrances (name, brand, url, notes_top, notes_middle, notes_base, accords,
                               rating, rating_count, votes, perfumer, description,
                               image_url, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        name = excluded.name, brand = excluded.brand,
        notes_top = excluded.notes_top, notes_middle = excluded.notes_middle, notes_base = excluded.notes_base,
        accords = excluded.accords, rating = excluded.rating, rating_count = excluded.rating_count,
        votes = excluded.votes, perfumer = excluded.perfumer,
        description = excluded.description, image_url = excluded.image_url, scraped_at = excluded.scraped_at
    `,
    args: [
      fragrance.name,
      fragrance.brand,
      fragrance.url,
      JSON.stringify(fragrance.notesTop),
      JSON.stringify(fragrance.notesMiddle),
      JSON.stringify(fragrance.notesBase),
      JSON.stringify(fragrance.accords),
      fragrance.rating,
      fragrance.ratingCount,
      fragrance.votes ? JSON.stringify(fragrance.votes) : null,
      fragrance.perfumer,
      fragrance.description,
      fragrance.imageUrl,
      fragrance.scrapedAt,
    ],
  });
  const row = await getByUrl(fragrance.url);
  return row!.id!;
}
