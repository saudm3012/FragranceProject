"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Fragrance } from "@/lib/schemas";

type SortKey = "name" | "brand" | "rating" | "ratingCount" | "scrapedAt";
type SortDir = "asc" | "desc";

function compareValues(a: unknown, b: unknown): number {
  // Nulls/undefined always sort last, regardless of direction.
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export default function DbBrowsePage() {
  const [fragrances, setFragrances] = useState<Fragrance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("scrapedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    fetch("/api/fragrances")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json();
      })
      .then(setFragrances)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const visible = useMemo(() => {
    if (!fragrances) return [];
    const needle = filter.trim().toLowerCase();
    const filtered = needle
      ? fragrances.filter(
          (f) => f.name.toLowerCase().includes(needle) || f.brand.toLowerCase().includes(needle)
        )
      : fragrances;

    const sorted = [...filtered].sort((a, b) => {
      const cmp = compareValues(a[sortKey], b[sortKey]);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [fragrances, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <nav className="nav-links">
        <Link href="/">Home</Link>
        <Link href="/find">Find Fragrance</Link>
        <Link href="/collection">Collection</Link>
      </nav>
      <h1>Database ({fragrances?.length ?? "…"})</h1>

      <input
        className="text-input"
        style={{ marginBottom: "1rem" }}
        type="text"
        placeholder="Filter by name or brand..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {error && <p className="error">{error}</p>}
      {!fragrances && !error && <p className="spinner-text">Loading…</p>}
      {fragrances && visible.length === 0 && <p className="muted">No matches.</p>}

      {fragrances && visible.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <SortableHeader label="Name" sortKey="name" current={sortKey} onClick={toggleSort} indicator={sortIndicator("name")} />
                <SortableHeader label="Brand" sortKey="brand" current={sortKey} onClick={toggleSort} indicator={sortIndicator("brand")} />
                <SortableHeader label="Rating" sortKey="rating" current={sortKey} onClick={toggleSort} indicator={sortIndicator("rating")} />
                <SortableHeader label="Votes" sortKey="ratingCount" current={sortKey} onClick={toggleSort} indicator={sortIndicator("ratingCount")} />
                <th style={thStyle}>Top Accord</th>
                <th style={thStyle}>Perfumer</th>
                <SortableHeader label="Scraped At" sortKey="scrapedAt" current={sortKey} onClick={toggleSort} indicator={sortIndicator("scrapedAt")} />
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.id}>
                  <td style={tdStyle}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer">
                      {f.name}
                    </a>
                  </td>
                  <td style={tdStyle}>{f.brand}</td>
                  <td style={tdStyle}>{f.rating != null ? f.rating.toFixed(2) : "—"}</td>
                  <td style={tdStyle}>{f.ratingCount ?? "—"}</td>
                  <td style={tdStyle}>{f.accords[0]?.name ?? "—"}</td>
                  <td style={tdStyle}>{f.perfumer ?? "—"}</td>
                  <td style={tdStyle}>{new Date(f.scrapedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.4rem 0.6rem",
  borderBottom: "1px solid rgba(128,128,128,0.4)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  borderBottom: "1px solid rgba(128,128,128,0.15)",
};

function SortableHeader({
  label,
  sortKey,
  current,
  onClick,
  indicator,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  onClick: (key: SortKey) => void;
  indicator: string;
}) {
  return (
    <th
      style={{ ...thStyle, cursor: "pointer", fontWeight: current === sortKey ? 700 : 400 }}
      onClick={() => onClick(sortKey)}
    >
      {label}
      {indicator}
    </th>
  );
}
