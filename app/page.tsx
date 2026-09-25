import Link from "next/link";
import { NAV_ITEMS } from "@/app/navigation";

export default function Home() {
  const destinations = NAV_ITEMS.filter((item) => item.href !== "/");
  return (
    <div className="container">
      <h1>Fragrantica Lookup</h1>
      <div className="button-row">
        {destinations.map((item, i) => (
          <Link key={item.href} href={item.href} className={i === 0 ? "button button-primary" : "button"}>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
