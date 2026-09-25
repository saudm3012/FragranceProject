"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import NavLinks from "@/app/components/NavLinks";
import type { Fragrance } from "@/lib/schemas";
import {
  getUsername,
  getCollection,
  removeFromCollection,
  USERNAME_CHANGED_EVENT,
} from "@/lib/client/localCollection";

export default function CollectionPage() {
  const [username, setUsernameState] = useState<string | null | undefined>(undefined);
  const [fragrances, setFragrances] = useState<Fragrance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = useCallback(async (currentUsername: string) => {
    setError(null);
    const entries = getCollection(currentUsername);
    if (entries.length === 0) {
      setFragrances([]);
      return;
    }
    try {
      const ids = entries.map((e) => e.fragranceId).join(",");
      const res = await fetch(`/api/fragrances?ids=${ids}`);
      if (!res.ok) throw new Error(`Failed to load collection (${res.status})`);
      setFragrances(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    const onUsernameChange = () => setUsernameState(getUsername());
    onUsernameChange();
    window.addEventListener(USERNAME_CHANGED_EVENT, onUsernameChange);
    return () => window.removeEventListener(USERNAME_CHANGED_EVENT, onUsernameChange);
  }, []);

  useEffect(() => {
    if (username) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/username-change; setState happens after the await, not synchronously
      load(username);
    } else {
      setFragrances(null);
    }
  }, [username, load]);

  function handleRemove(fragranceId: number) {
    if (!username) return;
    setRemovingId(fragranceId);
    removeFromCollection(username, fragranceId);
    setFragrances((prev) => prev?.filter((f) => f.id !== fragranceId) ?? null);
    setRemovingId(null);
  }

  async function handleRefresh() {
    if (!username || !fragrances) return;
    setRefreshing(true);
    setError(null);
    try {
      const ids = fragrances.map((f) => f.id).filter((id): id is number => id != null);
      const res = await fetch("/api/collection/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fragrance_ids: ids }),
      });
      if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
      await load(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="container">
      <NavLinks />
      <h1>Collection</h1>

      {username === undefined && null}
      {username === null && (
        <p className="muted">Set a username above to see your collection.</p>
      )}

      {username && fragrances && fragrances.length > 0 && (
        <div className="button-row" style={{ marginBottom: "1.5rem" }}>
          <button className="button" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {username && !fragrances && !error && <p className="spinner-text">Loading…</p>}
      {username && fragrances && fragrances.length === 0 && (
        <p className="muted">
          Nothing saved yet. Go to <Link href="/find">Find Fragrance</Link> to add some.
        </p>
      )}

      {fragrances?.map((f) => (
        <div
          key={f.id}
          className="card"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <strong>{f.name}</strong>
            <div className="muted">{f.brand}</div>
          </div>
          <button
            className="button"
            onClick={() => f.id != null && handleRemove(f.id)}
            disabled={removingId === f.id}
          >
            {removingId === f.id ? "Removing…" : "Remove"}
          </button>
        </div>
      ))}
    </div>
  );
}
