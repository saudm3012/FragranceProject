"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Fragrance } from "@/lib/schemas";

interface CollectionEntry {
  collectionId: number;
  addedAt: string;
  fragrance: Fragrance;
}

export default function CollectionPage() {
  const [entries, setEntries] = useState<CollectionEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/collection");
      if (!res.ok) throw new Error(`Failed to load collection (${res.status})`);
      setEntries(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    // Standard fetch-on-mount; load()'s setState happens after the await,
    // not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleRemove(collectionId: number) {
    setRemovingId(collectionId);
    setError(null);
    try {
      const res = await fetch(`/api/collection/${collectionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Remove failed (${res.status})`);
      setEntries((prev) => prev?.filter((e) => e.collectionId !== collectionId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/collection/refresh", { method: "POST" });
      if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="container">
      <nav className="nav-links">
        <Link href="/">Home</Link>
        <Link href="/find">Find Fragrance</Link>
      </nav>
      <h1>Collection</h1>

      {entries && entries.length > 0 && (
        <div className="button-row" style={{ marginBottom: "1.5rem" }}>
          <button className="button" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!entries && !error && <p className="spinner-text">Loading…</p>}
      {entries && entries.length === 0 && (
        <p className="muted">
          Nothing saved yet. Go to <Link href="/find">Find Fragrance</Link> to add some.
        </p>
      )}

      {entries?.map((entry) => (
        <div key={entry.collectionId} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>{entry.fragrance.name}</strong>
            <div className="muted">{entry.fragrance.brand}</div>
          </div>
          <button
            className="button"
            onClick={() => handleRemove(entry.collectionId)}
            disabled={removingId === entry.collectionId}
          >
            {removingId === entry.collectionId ? "Removing…" : "Remove"}
          </button>
        </div>
      ))}
    </div>
  );
}
