import { cookies } from "next/headers";
import { isProduction } from "@/lib/server/env";
import { assertSameOrigin, handle, json } from "@/lib/server/http";
import { check, clientIp, subnetOf } from "@/lib/server/rateLimit";
import { recordVisit } from "@/lib/server/visits";

// POST /api/visit - count this browser once. No body, no response data, nothing stored about
// the caller beyond a value-less cookie that says "already counted".
//
// Why a route and not the page render: setting a cookie is only allowed in a route handler or
// server action, and without a cookie the count would climb on every refresh.

const COOKIE = "rk_seen";
const DAY = 60 * 60 * 24;

/** Obvious crawlers, which would otherwise make up most of the number. */
const BOT = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headlesschrome|lighthouse|pingdom|uptime/i;

export async function POST(req: Request) {
  return handle(async () => {
    // S10: only our own pages may call this, so the counter cannot be driven from another site.
    assertSameOrigin(req);

    // A ceiling per subnet per hour. It does not make the number honest - someone determined
    // can still pump it - but it stops a single machine running it up in a loop.
    await check(`visit:${subnetOf(clientIp(req))}`, 60, 3600);

    if (BOT.test(req.headers.get("user-agent") ?? "")) return json({ ok: true });

    const jar = await cookies();
    if (jar.get(COOKIE)) return json({ ok: true });

    await recordVisit();
    jar.set(COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      path: "/",
      maxAge: DAY,
    });
    return json({ ok: true });
  });
}
