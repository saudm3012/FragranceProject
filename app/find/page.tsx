"use client";

import { useRef, useState } from "react";
import InCollectionIcon from "@/app/components/InCollectionIcon";
import NavLinks from "@/app/components/NavLinks";
import Pager from "@/app/components/Pager";
import { quickAdd, resolveFragrance, searchFragrances } from "@/lib/client/api";
import * as fragranceCache from "@/lib/client/fragranceCache";
import { useCollectionIds, useFragrances, useUsername } from "@/lib/client/hooks";
import { addToCollection } from "@/lib/client/localCollection";
import { isStub, type Candidate, type Fragrance, type SearchResponse } from "@/lib/schemas";

export default function FindFragrancePage() {
  const [query, setQuery] = useState("");
  const [searchedFor, setSearchedFor] = useState(""); // the query the shown results belong to (the input may have changed since)
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [searchCount, setSearchCount] = useState(0); // keys result rows, so each new search/page starts collapsed
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const username = useUsername();
  const collectionIdList = useCollectionIds(username);
  const collectionIds = new Set(collectionIdList);

  async function runSearch(q: string, page: number) {
    setSearching(true);
    setError(null);
    try {
      setResponse(await searchFragrances(q, page));
      setSearchedFor(q);
      setSearchCount((n) => n + 1);
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

  async function goToPage(page: number) {
    await runSearch(searchedFor, page);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="container">
      <NavLinks />
      <h1>Find Fragrance</h1>

      <form className="search-form" onSubmit={handleSearch}>
        <input
          className="text-input"
          type="text"
          placeholder="Fragrance name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button button-primary" type="submit" disabled={searching}>
          Search
        </button>
      </form>

      {searching && <p className="spinner-text">Searching…</p>}
      {error && <p className="error">{error}</p>}
      {username === null && <p className="muted">Set a username above to save fragrances to a collection.</p>}

      {response && response.source === "cache" && (
        <p className="muted">Fragrantica&apos;s search is unreachable right now - showing saved matches only.</p>
      )}
      {response && response.candidates.length === 0 && <p className="muted">No matches found.</p>}

      {response && response.candidates.length > 0 && (
        <div ref={resultsRef} className="results-section">
          <h2>Results</h2>
          {response.candidates.map((c) => (
            <ResultRow key={`${searchCount}|${c.url}`} candidate={c} username={username ?? null} collectionIds={collectionIds} />
          ))}
          <Pager
            page={response.page}
            totalPages={response.totalPages}
            totalHits={response.totalHits}
            onChange={goToPage}
            disabled={searching}
          />
        </div>
      )}
    </div>
  );
}

/**
 * One search result: expands in place to show details (other results stay
 * visible), and can be added to the collection straight away - new
 * fragrances are stored as a stub and their details load in the background.
 */
function ResultRow({
  candidate,
  username,
  collectionIds,
}: {
  candidate: Candidate;
  username: string | null;
  collectionIds: ReadonlySet<number>;
}) {
  const [learnedId, setLearnedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = candidate.id ?? learnedId;
  const { get } = useFragrances(id != null ? [id] : []);
  const stored = id != null ? get(id) : undefined;
  const details = stored && !isStub(stored) ? stored : null;
  const inCollection = id != null && collectionIds.has(id);

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (!next || details || loadingDetails) return;
    setLoadingDetails(true);
    setError(null);
    try {
      const f = await resolveFragrance(candidate.url);
      fragranceCache.prime([f]);
      if (f.id != null) setLearnedId(f.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleAdd() {
    if (!username) return;
    setAdding(true);
    setError(null);
    try {
      // Already stored (even as a stub)? Adding is purely local - no request needed.
      let fragranceId = id;
      if (fragranceId == null) {
        const f = await quickAdd(candidate);
        fragranceCache.prime([f]);
        fragranceId = f.id ?? null;
        setLearnedId(fragranceId);
      }
      if (fragranceId != null) addToCollection(username, fragranceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={expanded ? "card result-row is-expanded" : "card result-row"}>
      <div className="result-row-header">
        <button type="button" className="result-row-main" onClick={toggle} aria-expanded={expanded}>
          <span className="result-row-chevron" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
          <span>
            <strong>
              {candidate.name}
              {inCollection && <InCollectionIcon />}
            </strong>
            <span className="muted result-row-brand">{candidate.brand}</span>
          </span>
        </button>
        <div className="result-row-actions">
          {inCollection ? (
            <span className="muted small">{stored && isStub(stored) ? "Added · loading details…" : "In collection"}</span>
          ) : (
            <button type="button" className="button" onClick={handleAdd} disabled={!username || adding}>
              {adding ? "Adding…" : "+ Add"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {expanded && (
        <div className="result-row-details">
          {details ? (
            <FragranceDetail fragrance={details} />
          ) : (
            <p className="spinner-text">Loading details… (the first look at a fragrance takes a few seconds)</p>
          )}
        </div>
      )}
    </div>
  );
}

function FragranceDetail({ fragrance }: { fragrance: Fragrance }) {
  return (
    <div>
      {fragrance.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="detail-image" src={fragrance.imageUrl} alt={fragrance.name} />
      )}
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
    </div>
  );
}
