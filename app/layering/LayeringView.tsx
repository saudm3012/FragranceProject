"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import FloatingTabs from "@/app/components/FloatingTabs";
import NavLinks from "@/app/components/NavLinks";
import { LAYERING_TABS } from "@/app/layering/tabs";
import { useCollectionIds, useUsername } from "@/lib/client/hooks";

export default function LayeringView() {
  const searchParams = useSearchParams();
  const username = useUsername();
  const collectionIdList = useCollectionIds(username);
  const collectionIds = useMemo(() => new Set(collectionIdList), [collectionIdList]);

  const requested = searchParams.get("tab");
  const activeId = LAYERING_TABS.some((t) => t.id === requested) ? requested! : LAYERING_TABS[0].id;

  // Native history updates integrate with useSearchParams in this Next.js
  // version - no navigation or re-render of the server tree needed.
  function goToTab(tabId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tabId);
    window.history.replaceState(null, "", `?${next.toString()}`);
  }

  return (
    <div className="container has-floating-tabs">
      <NavLinks />
      <h1>Layering</h1>

      {username === null && <p className="muted">Set a username above to start layering.</p>}

      {username &&
        // Every tab stays mounted (just hidden) so switching tabs doesn't
        // throw away in-progress work like suggestion results.
        LAYERING_TABS.map(({ id, Component }) => (
          <section key={id} id={`tabpanel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} hidden={id !== activeId}>
            <Component username={username} collectionIds={collectionIds} goToTab={goToTab} />
          </section>
        ))}

      {username && (
        <FloatingTabs tabs={LAYERING_TABS} activeId={activeId} onChange={goToTab} ariaLabel="Layering sections" />
      )}
    </div>
  );
}
