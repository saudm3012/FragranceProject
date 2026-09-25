"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/app/navigation";

/** Links to every top-level page except the current one. */
export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="nav-links">
      {NAV_ITEMS.filter((item) => item.href !== pathname).map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
