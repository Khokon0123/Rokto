import { Suspense } from "react";
import SearchClient from "@/components/SearchClient";
import UsernameSignIn from "@/components/UsernameSignIn";
import { accountFromCookies } from "@/lib/server/accountSession";

// The page headline lives in the red hero band (SiteHeader), same pattern as / and /register.
//
// The gate lives HERE, not on the homepage button: a link changed on the homepage would be walked
// straight past by anyone who types /search or follows a shared link. Signed out, the page asks for
// a username in place, so the filters in the address bar are still there once they are in.
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
    // Stay on /search (filters and all): they have a username, or they follow the link to get one.
    const registerHref = `/register?next=${encodeURIComponent(q ? `/search?${q}` : "/search")}`;
    return (
      <div className="relative -mt-14">
        <UsernameSignIn registerHref={registerHref} />
      </div>
    );
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
