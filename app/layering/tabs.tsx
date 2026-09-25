// The Layering page's tabs, in display order. To add a tab, write a
// component that takes LayeringTabProps and add an entry here - the
// floating switcher, URL (?tab=<id>) and panel rendering all follow.

import type { ComponentType } from "react";
import MyCombosTab from "@/app/layering/combos/MyCombosTab";
import IntelliScentTab from "@/app/layering/intelliscent/IntelliScentTab";
import type { LayeringTabProps } from "@/app/layering/types";

export interface LayeringTabDef {
  id: string; // also the ?tab= value
  label: string;
  Component: ComponentType<LayeringTabProps>;
}

export const LAYERING_TABS: readonly LayeringTabDef[] = [
  { id: "combos", label: "My Combos", Component: MyCombosTab },
  { id: "intelliscent", label: "IntelliScent", Component: IntelliScentTab },
];
