"use client";

import { useMemo } from "react";
import ComboCard from "@/app/layering/combos/ComboCard";
import type { LayeringTabProps } from "@/app/layering/types";
import { useCombos, useFragrances } from "@/lib/client/hooks";
import { deleteCombo, updateCombo } from "@/lib/client/localCombos";

export default function MyCombosTab({ username, collectionIds, goToTab }: LayeringTabProps) {
  const combos = useCombos(username);
  const sorted = useMemo(() => [...combos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [combos]);
  const { get, loading } = useFragrances(combos.flatMap((c) => c.fragranceIds));

  if (sorted.length === 0) {
    return (
      <div className="empty-state">
        <p className="muted">
          No combos yet. Use IntelliScent to find layers for scents in your collection, then save the ones
          you like here to journal how they wear.
        </p>
        <button type="button" className="button button-primary" onClick={() => goToTab("intelliscent")}>
          Open IntelliScent
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="muted section-intro">
        {sorted.length} saved combo{sorted.length === 1 ? "" : "s"}
      </p>
      {sorted.map((combo) => (
        <ComboCard
          key={combo.id}
          combo={combo}
          getFragrance={get}
          loading={loading}
          collectionIds={collectionIds}
          onSaveNotes={(notes) => updateCombo(username, combo.id, { notes })}
          onDelete={() => deleteCombo(username, combo.id)}
        />
      ))}
    </div>
  );
}
