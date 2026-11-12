import { redirect } from "next/navigation";
import { Suspense } from "react";
import SearchClient from "@/components/SearchClient";
import { accountFromCookies } from "@/lib/server/accountSession";

// The page headline lives in the red hero band (SiteHeader), same pattern as / and /register.
//
// The gate lives HERE, not on the homepage button: a link changed on the homepage would be walked
// straight past by anyone who types /search or follows a shared link. The filters are carried
// through the redirect so signing in lands you on the search you were actually trying to reach.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [account, params] = await Promise.all([accountFromCookies(), searchParams]);
  if (!account) {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string") query.set(k, v);
    }
    const q = query.toString();
    redirect(`/signin?next=${encodeURIComponent(q ? `/search?${q}` : "/search")}`);
  }

  return (
    <div className="relative -mt-14">
      {/* SearchClient reads the query string, which needs a Suspense boundary above it. */}
      <Suspense fallback={null}>
        <SearchClient />
      </Suspense>
    </div>
  );
}
