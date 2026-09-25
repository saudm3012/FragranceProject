// Top-level destinations, in display order. The home page buttons and every
// page's nav bar are generated from this list - add/remove/reorder here.

export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/find", label: "Find Fragrance" },
  { href: "/collection", label: "Collection" },
  { href: "/layering", label: "Layering" },
  { href: "/db", label: "Browse Database" },
];
