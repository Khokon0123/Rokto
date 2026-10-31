import { PHONE_REVEAL_MODE } from "@/config/app";
import { parseSearchParams, selectResults, type SearchResponse } from "@/lib/search";
import { loadDirectory } from "@/lib/server/directory";
import { handle } from "@/lib/server/http";
import { clientIp, hit } from "@/lib/server/rateLimit";
import { NextResponse } from "next/server";

// GET /api/search?group=&area=&compatible=1
// Answered from the cached directory (S2/S4): no phones in "tap" mode, unavailable donors never.
export function GET(req: Request) {
  return handle(async () => {
    // Generous: a person in an emergency changes filters a lot. This only stops scripted harvesting.
    await hit(`search:ip:${clientIp(req)}`, 300, 3600);
    const params = parseSearchParams(new URL(req.url).searchParams);
    const { results, total, truncated } = selectResults(await loadDirectory(), params);

    const donors: SearchResponse["donors"] = results.map(({ donor }) => ({
        id: donor.id,
        name: donor.name,
        bloodGroup: donor.bloodGroup,
        area: donor.area,
        lastDonated: donor.lastDonated ? donor.lastDonated.toISOString().slice(0, 10) : null,
        location: donor.location,
        // "public" mode (owner decision #1): phones ride along, still never more than one page.
        phone: PHONE_REVEAL_MODE === "public" ? donor.phone : "",
    }));
    const body: SearchResponse = { donors, total, truncated };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  });
}
