/** Small bookmark marker shown next to any fragrance that's in the user's collection. */
export default function InCollectionIcon() {
  return (
    <span className="in-collection-icon" role="img" aria-label="In your collection" title="In your collection">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M3.5 1.5h9v13L8 11.4l-4.5 3.1z" fill="currentColor" />
      </svg>
    </span>
  );
}
