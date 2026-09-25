"use client";

import type { ReactNode } from "react";
import InCollectionIcon from "@/app/components/InCollectionIcon";

/**
 * One fragrance as a compact row: thumbnail, name, brand, and the
 * in-collection marker. Used everywhere a fragrance is listed on the
 * Layering page. `onClick` makes the main area a button; `trailing` is a
 * slot for scores/actions beside it (kept outside the button so it can
 * hold its own buttons).
 */
export default function FragranceChip({
  name,
  brand,
  imageUrl,
  inCollection = false,
  selected = false,
  onClick,
  trailing,
}: {
  name: string;
  brand?: string;
  imageUrl?: string | null;
  inCollection?: boolean;
  selected?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="chip-thumb" src={imageUrl} alt="" />
      ) : (
        <span className="chip-thumb" aria-hidden="true" />
      )}
      <span className="chip-text">
        <span className="chip-name">
          {name}
          {inCollection && <InCollectionIcon />}
        </span>
        {brand && <span className="chip-brand">{brand}</span>}
      </span>
    </>
  );

  return (
    <div className={selected ? "fragrance-chip is-selected" : "fragrance-chip"}>
      {onClick ? (
        <button type="button" className="chip-main" onClick={onClick} aria-pressed={selected}>
          {body}
        </button>
      ) : (
        <div className="chip-main">{body}</div>
      )}
      {trailing && <div className="chip-trailing">{trailing}</div>}
    </div>
  );
}
