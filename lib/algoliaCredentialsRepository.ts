import { getDb } from "@/lib/db";

export interface AlgoliaCredentials {
  appId: string;
  apiKey: string;
  validUntil: number; // unix seconds
}

/** The one stored credential set, if present and not expired. */
export async function get(): Promise<AlgoliaCredentials | null> {
  const db = getDb();
  const result = await db.execute("SELECT app_id, api_key, valid_until FROM algolia_credentials WHERE id = 1");
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    appId: row.app_id as string,
    apiKey: row.api_key as string,
    validUntil: row.valid_until as number,
  };
}

export async function upsert(credentials: AlgoliaCredentials): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `
      INSERT INTO algolia_credentials (id, app_id, api_key, valid_until) VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET app_id = excluded.app_id, api_key = excluded.api_key, valid_until = excluded.valid_until
    `,
    args: [credentials.appId, credentials.apiKey, credentials.validUntil],
  });
}
