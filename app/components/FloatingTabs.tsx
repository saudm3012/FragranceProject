"use client";

import type { ReactNode } from "react";

export interface FloatingTab {
  id: string;
  label: string;
  icon?: ReactNode;
}

/**
 * A floating pill-shaped tab switcher pinned to the bottom of the viewport.
 * Purely presentational - the caller owns which tab is active. Pages using
 * it should add the `has-floating-tabs` class to their container so content
 * isn't hidden behind it.
 */
export default function FloatingTabs({
  tabs,
  activeId,
  onChange,
  ariaLabel,
}: {
  tabs: readonly FloatingTab[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="floating-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`tabpanel-${tab.id}`}
            className={active ? "floating-tab is-active" : "floating-tab"}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
