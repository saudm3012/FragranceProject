import { Suspense } from "react";
import type { Metadata } from "next";
import LayeringView from "@/app/layering/LayeringView";

export const metadata: Metadata = {
  title: "Layering · Fragrantica Lookup",
};

// LayeringView reads the active tab from the URL (useSearchParams), which
// requires a Suspense boundary so the rest of the page can still prerender.
export default function LayeringPage() {
  return (
    <Suspense
      fallback={
        <div className="container">
          <p className="spinner-text">Loading…</p>
        </div>
      }
    >
      <LayeringView />
    </Suspense>
  );
}
