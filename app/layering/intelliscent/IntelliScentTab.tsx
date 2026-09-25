"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import FragranceChip from "@/app/components/FragranceChip";
import { INTELLISCENT_ACTIONS } from "@/app/layering/intelliscent/actions";
import ParamPanel from "@/app/layering/intelliscent/ParamPanel";
import type { LayeringTabProps } from "@/app/layering/types";
import { useFragrances, useIntelliScentParams } from "@/lib/client/hooks";
import { defaultParams, INTELLISCENT_PARAMS } from "@/lib/intelliscent/params";
import type { Fragrance } from "@/lib/schemas";

export default function IntelliScentTab({ username, collectionIds, goToTab }: LayeringTabProps) {
  const [params, setParams] = useIntelliScentParams(username);
  const ids = useMemo(() => [...collectionIds], [collectionIds]);
  const { get, loading } = useFragrances(ids);
  const collection = ids.map(get).filter((f): f is Fragrance => f != null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // If the picked fragrance leaves the collection (e.g. removed in another tab), drop the selection.
  const selected = selectedId != null && collectionIds.has(selectedId) ? get(selectedId) : undefined;
  const action = INTELLISCENT_ACTIONS.find((a) => a.id === actionId);

  useEffect(() => {
    if (selectedId != null) sheetRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  function select(id: number) {
    setSelectedId((current) => (current === id ? null : id));
    setActionId(null);
  }

  return (
    <div>
      <ParamPanel
        defs={INTELLISCENT_PARAMS}
        values={params}
        onChange={setParams}
        onReset={() => setParams(defaultParams())}
      />

      <h2>Your collection</h2>
      {ids.length === 0 ? (
        <p className="muted">
          Your collection is empty - <Link href="/find">find fragrances</Link> to add some, then pick one here to
          layer on.
        </p>
      ) : (
        <>
          <p className="muted section-intro">Pick a base scent to layer on.</p>
          {loading && collection.length === 0 && <p className="spinner-text">Loading…</p>}
          <div className="chip-grid">
            {collection.map((f) => (
              <FragranceChip
                key={f.id}
                name={f.name}
                brand={f.brand}
                imageUrl={f.imageUrl}
                selected={f.id === selectedId}
                onClick={() => select(f.id!)}
              />
            ))}
          </div>
        </>
      )}

      {selected?.id != null && (
        <div ref={sheetRef} className="action-sheet">
          <p>
            Layer with <strong>{selected.name}</strong>:
          </p>
          <div className="action-options">
            {INTELLISCENT_ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={a.id === actionId ? "action-option is-active" : "action-option"}
                aria-pressed={a.id === actionId}
                onClick={() => setActionId(a.id)}
              >
                <strong>{a.label}</strong>
                <span className="muted">{a.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected?.id != null && action && (
        <action.Panel
          key={`${selected.id}:${action.id}`}
          base={{ ...selected, id: selected.id }}
          params={params}
          username={username}
          collection={collection}
          collectionIds={collectionIds}
          goToTab={goToTab}
        />
      )}
    </div>
  );
}
