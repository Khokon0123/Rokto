import { Suspense } from "react";
import SearchClient from "@/components/SearchClient";

// The page headline lives in the red hero band (SiteHeader), same pattern as / and /register.
export default function SearchPage() {
  return (
    <div className="relative -mt-14">
      {/* SearchClient reads the query string, which needs a Suspense boundary above it. */}
      <Suspense fallback={null}>
        <SearchClient />
      </Suspense>
    </div>
  );
}
