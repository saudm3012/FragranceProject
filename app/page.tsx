import Link from "next/link";

export default function Home() {
  return (
    <div className="container">
      <h1>Fragrantica Lookup</h1>
      <div className="button-row">
        <Link href="/find" className="button button-primary">
          Find Fragrance
        </Link>
        <Link href="/collection" className="button">
          Collection
        </Link>
        <Link href="/db" className="button">
          Browse Database
        </Link>
      </div>
    </div>
  );
}
