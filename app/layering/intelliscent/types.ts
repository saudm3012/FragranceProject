import type { EnginePayload } from "@/lib/intelliscent/types";
import type { Fragrance } from "@/lib/schemas";

/** What every IntelliScent action panel receives once a base fragrance is picked. */
export interface IntelliScentActionProps {
  base: Fragrance & { id: number };
  username: string;
  engine: EnginePayload; // the user's current settings, personal layer, profile edits and clash list
  collection: Fragrance[];
  collectionIds: ReadonlySet<number>;
  goToTab: (tabId: string) => void;
}
