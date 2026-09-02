import { getDb } from "@/lib/db";
import type { Fragrance } from "@/lib/schemas";

export interface CollectionEntry {
  collectionId: number;
  addedAt: string;
  fragrance: Fragrance;
}

interface JoinedRow {
  collection_id: number;
  added_at: string;
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
  longevity: string | null;
  sillage: string | null;
  perfumer: string | null;
  description: string | null;
  image_url: string | null;
  scraped_at: string;
}

function rowToEntry(row: JoinedRow): CollectionEntry {
  return {
    collectionId: row.collection_id,
    addedAt: row.added_at,
    fragrance: {
      id: row.id,
      name: row.name,
      brand: row.brand,
      url: row.url,
      notesTop: row.notes_top ? JSON.parse(row.notes_top) : [],
      notesMiddle: row.notes_middle ? JSON.parse(row.notes_middle) : [],
      notesBase: row.notes_base ? JSON.parse(row.notes_base) : [],
      accords: row.accords ? JSON.parse(row.accords) : [],
      rating: row.rating,
      ratingCount: row.rating_count,
      longevity: row.longevity,
      sillage: row.sillage,
      perfumer: row.perfumer,
      description: row.description,
      imageUrl: row.image_url,
      scrapedAt: row.scraped_at,
    },
  };
}

const JOIN_SELECT = `
  SELECT c.id AS collection_id, c.added_at AS added_at, f.*
  FROM collection c
  JOIN fragrances f ON f.id = c.fragrance_id
`;

export async function list(): Promise<CollectionEntry[]> {
  const db = getDb();
  const result = await db.execute(`${JOIN_SELECT} ORDER BY c.added_at DESC`);
  return result.rows.map((r) => rowToEntry(r as unknown as JoinedRow));
}

export async function add(fragranceId: number): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "INSERT INTO collection (fragrance_id, added_at) VALUES (?, ?) ON CONFLICT(fragrance_id) DO NOTHING",
    args: [fragranceId, new Date().toISOString()],
  });
}

export async function remove(collectionId: number): Promise<void> {
  const db = getDb();
  await db.execute({ sql: "DELETE FROM collection WHERE id = ?", args: [collectionId] });
}

export async function listUrls(): Promise<string[]> {
  const db = getDb();
  const result = await db.execute(
    "SELECT f.url FROM collection c JOIN fragrances f ON f.id = c.fragrance_id"
  );
  return result.rows.map((r) => r.url as string);
}
