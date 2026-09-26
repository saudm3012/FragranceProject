"use client";

import { useMemo } from "react";
import ComboCard from "@/app/layering/combos/ComboCard";
import type { LayeringTabProps } from "@/app/layering/types";
import { useClashPairs, useCombos, useEnginePayload, useFragrances } from "@/lib/client/hooks";
import { pairKey } from "@/lib/intelliscent/engine";

export default function MyCombosTab({ username, collectionIds, goToTab }: LayeringTabProps) {
  const combos = useCombos(username);
  const sorted = useMemo(() => [...combos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [combos]);
  const { get, loading } = useFragrances(combos.flatMap((c) => c.fragranceIds));
  const { payload } = useEnginePayload(username);
  const clashPairs = useClashPairs(username);
  const clashKeys = useMemo(() => new Set(clashPairs.map(([a, b]) => pairKey(a, b))), [clashPairs]);

  if (sorted.length === 0) {
    return (
      <div className="empty-state">
        <p className="muted">
          No combos yet. Use IntelliScent to find layers for scents in your collection, then save the ones you like
          here to journal how they wear. Rating each wear teaches IntelliScent your taste.
        </p>
        <button type="button" className="button button-primary" onClick={() => goToTab("intelliscent")}>
          Open IntelliScent
        </button>
      </div>
    );
  }

  const isClash = (ids: number[]) => {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (!clashKeys.has(pairKey(ids[i], ids[j]))) return false;
    return true;
  };

  return (
    <div>
      <p className="muted section-intro">
        {sorted.length} saved combo{sorted.length === 1 ? "" : "s"}
      </p>
      {sorted.map((combo) => (
        <ComboCard
          key={combo.id}
          combo={combo}
          username={username}
          engine={payload}
          getFragrance={get}
          loading={loading}
          collectionIds={collectionIds}
          isClash={isClash(combo.fragranceIds)}
        />
      ))}
    </div>
  );
}
