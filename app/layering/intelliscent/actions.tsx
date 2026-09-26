// What you can do after clicking a fragrance in IntelliScent, in display
// order. To add an action, write a panel taking IntelliScentActionProps and
// add an entry here - the chooser and panel rendering follow automatically.

import type { ComponentType } from "react";
import ComboMatchPanel from "@/app/layering/intelliscent/ComboMatchPanel";
import ProfilePanel from "@/app/layering/intelliscent/ProfilePanel";
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
    description: "Rank pairs (and light third scents) that layer well with this one.",
    Panel: SuggestionsPanel,
  },
  {
    id: "match",
    label: "Combo match",
    description: "Pick scents to wear with it and get the combo scored, with a recipe.",
    Panel: ComboMatchPanel,
  },
  {
    id: "profile",
    label: "Profile",
    description: "See how IntelliScent reads this scent, and correct it from how it actually wears on you.",
    Panel: ProfilePanel,
  },
];
