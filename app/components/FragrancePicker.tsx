"use client";

import { useEffect, useRef, useState } from "react";
import FragranceChip from "@/app/components/FragranceChip";
import Pager from "@/app/components/Pager";
import { isAbortError, resolveFragrance, searchFragrances } from "@/lib/client/api";
import * as fragranceCache from "@/lib/client/fragranceCache";
import { isStub, type Candidate, type Fragrance, type SearchResponse } from "@/lib/schemas";

type Source = "collection" | "search";

const SOURCES: ReadonlyArray<{ id: Source; label: string }> = [
  { id: "collection", label: "My collection" },
  { id: "search", label: "Search all" },
];

/**
 * Pick a fragrance either from the user's collection (instant) or by
 * searching everything (resolving a search hit fetches the full record,
 * which can take several seconds for a fragrance nobody's looked up yet).
 */
export default function FragrancePicker({
  collection,
  excludeIds,
  onPick,
}: {
  collection: Fragrance[];
  excludeIds: ReadonlySet<number>;
  onPick: (fragrance: Fragrance) => void;
}) {
  const [source, setSource] = useState<Source>("collection");
  const [query, setQuery] = useState("");
  const [searchedFor, setSearchedFor] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const resolveRequest = useRef<AbortController | null>(null);
  useEffect(() => () => resolveRequest.current?.abort(), []);
  const [searching, setSearching] = useState(false);
  const [resolvingUrl, setResolvingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates = response?.candidates ?? null;
  const collectionUrls = new Set(collection.map((f) => f.url));
  const available = collection.filter((f) => f.id != null && !excludeIds.has(f.id));

  async function runSearch(q: string, page: number) {
    setSearching(true);
    setError(null);
    try {
      setResponse(await searchFragrances(q, page));
      setSearchedFor(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) void runSearch(query.trim(), 0);
  }

  // Picking another result while one is loading cancels waiting on the first.
  async function handlePickCandidate(candidate: Candidate) {
    resolveRequest.current?.abort();
    const controller = new AbortController();
    resolveRequest.current = controller;
    setResolvingUrl(candidate.url);
    setError(null);
    try {
      // Stored (or custom) already? Use the database record; only unknown ones go through Fragrantica.
      if (candidate.id != null) {
        await fragranceCache.ensure([candidate.id]);
        const cached = fragranceCache.getCached(candidate.id);
        if (controller.signal.aborted) return;
        if (cached && !isStub(cached)) return onPick(cached);
      }
      const fragrance = await resolveFragrance(candidate.url, controller.signal);
      fragranceCache.prime([fragrance]);
      onPick(fragrance);
    } catch (err) {
      if (!isAbortError(err)) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (resolveRequest.current === controller) {
        resolveRequest.current = null;
        setResolvingUrl(null);
      }
    }
  }

  return (
    <div className="fragrance-picker">
      <div className="segmented" role="group" aria-label="Pick from">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === source ? "segmented-option is-active" : "segmented-option"}
            aria-pressed={s.id === source}
            onClick={() => setSource(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {source === "collection" && (
        <div className="chip-list">
          {available.length === 0 && <p className="muted">No other fragrances in your collection to add.</p>}
          {available.map((f) => (
            <FragranceChip
              key={f.id}
              name={f.name}
              brand={f.brand}
              imageUrl={f.imageUrl}
              onClick={() => onPick(f)}
            />
          ))}
        </div>
      )}

      {source === "search" && (
        <>
          <form className="search-form" onSubmit={handleSearch}>
            <input
              className="text-input"
              type="text"
              placeholder="Search any fragrance..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="button" type="submit" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {candidates && candidates.length === 0 && <p className="muted">No matches found.</p>}
          <div className="chip-list">
            {candidates?.map((c) => (
              <FragranceChip
                key={c.url}
                name={c.name}
                brand={c.brand}
                inCollection={collectionUrls.has(c.url)}
                onClick={resolvingUrl === c.url ? undefined : () => handlePickCandidate(c)}
                trailing={resolvingUrl === c.url ? <span className="spinner-text">Adding…</span> : null}
              />
            ))}
          </div>
          {response && (
            <Pager
              page={response.page}
              totalPages={response.totalPages}
              totalHits={response.totalHits}
              onChange={(p) => void runSearch(searchedFor, p)}
              disabled={searching}
            />
          )}
        </>
      )}
    </div>
  );
}
