/** What every Layering tab receives. Extend this to give all tabs a new shared input. */
export interface LayeringTabProps {
  username: string;
  collectionIds: ReadonlySet<number>;
  goToTab: (tabId: string) => void;
}
