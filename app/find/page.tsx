"use client";

import { useState } from "react";
import Link from "next/link";
import type { Candidate, Fragrance } from "@/lib/schemas";

type Status = "idle" | "searching" | "loading-detail" | "adding";

export default function FindFragrancePage() {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [fragrance, setFragrance] = useState<Fragrance | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setStatus("searching");
    setError(null);
    setFragrance(null);
    setAdded(false);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      setCandidates(data.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("idle");
    }
  }

  async function handlePickCandidate(candidate: Candidate) {
    setStatus("loading-detail");
    setError(null);
    setAdded(false);
    try {
      const res = await fetch(`/api/fragrance?url=${encodeURIComponent(candidate.url)}`);
      if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
      const data = await res.json();
      setFragrance(data);
      setCandidates(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("idle");
    }
  }

  async function handleAddToCollection() {
    if (!fragrance?.id) return;
    setStatus("adding");
    setError(null);
    try {
      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fragrance_id: fragrance.id }),
      });
      if (!res.ok) throw new Error(`Add to collection failed (${res.status})`);
      setAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="container">
      <nav className="nav-links">
        <Link href="/">Home</Link>
        <Link href="/collection">Collection</Link>
      </nav>
      <h1>Find Fragrance</h1>

      <form className="search-form" onSubmit={handleSearch}>
        <input
          className="text-input"
          type="text"
          placeholder="Fragrance name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button button-primary" type="submit" disabled={status === "searching"}>
          Search
        </button>
      </form>

      {status === "searching" && <p className="spinner-text">Searching…</p>}
      {status === "loading-detail" && <p className="spinner-text">Loading fragrance details…</p>}
      {error && <p className="error">{error}</p>}

      {candidates && candidates.length === 0 && <p className="muted">No matches found.</p>}

      {candidates && candidates.length > 0 && (
        <div>
          <h2>Results</h2>
          {candidates.map((c) => (
            <div key={c.url} className="card card-list-item" onClick={() => handlePickCandidate(c)}>
              <div>
                <strong>{c.name}</strong>
                <div className="muted">{c.brand}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {fragrance && <FragranceDetail fragrance={fragrance} added={added} onAdd={handleAddToCollection} adding={status === "adding"} />}
    </div>
  );
}

function FragranceDetail({
  fragrance,
  added,
  onAdd,
  adding,
}: {
  fragrance: Fragrance;
  added: boolean;
  onAdd: () => void;
  adding: boolean;
}) {
  return (
    <div className="card">
      {fragrance.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="detail-image" src={fragrance.imageUrl} alt={fragrance.name} />
      )}
      <h2>{fragrance.name}</h2>
      <p className="muted">{fragrance.brand}</p>

      {fragrance.rating != null && (
        <p>
          Rating: {fragrance.rating.toFixed(2)}
          {fragrance.ratingCount != null && ` (${fragrance.ratingCount} votes)`}
        </p>
      )}
      {fragrance.perfumer && <p>Perfumer: {fragrance.perfumer}</p>}

      {fragrance.accords.length > 0 && (
        <>
          <h2>Main Accords</h2>
          {fragrance.accords.map((a) => (
            <div key={a.name} className="accord-bar-row">
              <span style={{ width: 90 }}>{a.name}</span>
              <div className="accord-bar-track">
                <div className="accord-bar-fill" style={{ width: `${a.strength}%` }} />
              </div>
            </div>
          ))}
        </>
      )}

      {fragrance.notesTop.length > 0 && (
        <>
          <h2>Notes</h2>
          <div className="note-list">
            <strong>Top:</strong> {fragrance.notesTop.join(", ")}
          </div>
          <div className="note-list">
            <strong>Middle:</strong> {fragrance.notesMiddle.join(", ")}
          </div>
          <div className="note-list">
            <strong>Base:</strong> {fragrance.notesBase.join(", ")}
          </div>
        </>
      )}

      {fragrance.description && <p className="muted">{fragrance.description}</p>}

      <div style={{ marginTop: "1rem" }}>
        <button className="button button-primary" onClick={onAdd} disabled={added || adding}>
          {added ? "Added to Collection" : adding ? "Adding…" : "Add to Collection"}
        </button>
      </div>
    </div>
  );
}
