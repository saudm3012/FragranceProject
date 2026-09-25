// What you can do after clicking a fragrance in IntelliScent, in display
// order. To add an action, write a panel taking IntelliScentActionProps and
// add an entry here - the chooser and panel rendering follow automatically.

import type { ComponentType } from "react";
import ComboMatchPanel from "@/app/layering/intelliscent/ComboMatchPanel";
import SuggestionsPanel from "@/app/layering/intelliscent/SuggestionsPanel";
import type { IntelliScentActionProps } from "@/app/layering/intelliscent/types";

export interface IntelliScentActionDef {
  id: string;
  label: string;
  description: string;
  Panel: ComponentType<IntelliScentActionProps>;
}

export const INTELLISCENT_ACTIONS: readonly IntelliScentActionDef[] = [
  {
    id: "suggest",
    label: "Create suggestions",
    description: "Let IntelliScent rank fragrances that layer well with this one.",
    Panel: SuggestionsPanel,
  },
  {
    id: "match",
    label: "Combo match",
    description: "Pick one or more scents to wear with it and get the combo rated.",
    Panel: ComboMatchPanel,
  },
];
