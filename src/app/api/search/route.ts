import { PHONE_REVEAL_MODE } from "@/config/app";
import { parseSearchParams, selectResults, type SearchResponse } from "@/lib/search";
import { loadDirectory } from "@/lib/server/directory";
import { ApiError, handle } from "@/lib/server/http";
import { currentAccount } from "@/lib/server/accountAuth";
import { NextResponse } from "next/server";

// GET /api/search?group=&area=&compatible=1
// Answered from the cached directory (S2/S4): no phones in "tap" mode, unavailable donors never,
// and no donor coordinates at all - the area is the finest location this endpoint will publish.
export function GET(req: Request) {
  return handle(async () => {
    // Signed in only: without this the page gate would be decoration, since the directory is one
    // fetch away. Checked from the cookie signature alone - no database read on a hot path.
    if (!currentAccount(req)) throw new ApiError(401, "account_required");
    // No per-visitor rate limit here on purpose: answers come from a cache and carry no phone
    // numbers, and a Firestore-backed counter would cost a read + write per search (S4).
    const params = parseSearchParams(new URL(req.url).searchParams);
    const { results, total, truncated } = selectResults(await loadDirectory(), params);

    const donors: SearchResponse["donors"] = results.map(({ donor }) => ({
        id: donor.id,
        name: donor.name,
        bloodGroup: donor.bloodGroup,
        area: donor.area,
        avatar: donor.avatar ?? null,
        lastDonated: donor.lastDonated ? donor.lastDonated.toISOString().slice(0, 10) : null,
        // "public" mode (owner decision #1): phones ride along, still never more than one page.
        phone: PHONE_REVEAL_MODE === "public" ? donor.phone : "",
    }));
    const body: SearchResponse = { donors, total, truncated };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  });
}
