import type { IntelliScentParams } from "@/lib/intelliscent/params";
import type { Fragrance } from "@/lib/schemas";

/** What every IntelliScent action panel receives once a base fragrance is picked. */
export interface IntelliScentActionProps {
  base: Fragrance & { id: number };
  params: IntelliScentParams;
  username: string;
  collection: Fragrance[];
  collectionIds: ReadonlySet<number>;
  goToTab: (tabId: string) => void;
}
