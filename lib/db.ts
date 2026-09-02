import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function getDb(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are not set");
  }

  client = createClient({ url, authToken });
  return client;
}
