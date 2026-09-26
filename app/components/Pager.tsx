"use client";

/** Previous / "Page X of Y" / Next controls. `page` is 0-based; renders nothing for a single page. */
export default function Pager({
  page,
  totalPages,
  totalHits,
  onChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  totalHits?: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pager" aria-label="Search result pages">
      <button type="button" className="button" disabled={disabled || page === 0} onClick={() => onChange(page - 1)}>
        ← Previous
      </button>
      <span className="muted small">
        Page {page + 1} of {totalPages}
        {totalHits != null && ` · ${totalHits.toLocaleString()} results`}
      </span>
      <button
        type="button"
        className="button"
        disabled={disabled || page >= totalPages - 1}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}
