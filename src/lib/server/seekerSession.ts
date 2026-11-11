import "server-only";
import { cookies } from "next/headers";
import { readSeekerSession, SEEKER_COOKIE, type SeekerSession } from "./seekerAuth";

// Kept apart from seekerAuth.ts on purpose: that module is pure crypto and is unit-tested outside
// Next, and importing next/headers there would drag a request scope into those tests.

/** The signed-in seeker, for server components (the layout renders the header from this). */
export async function seekerFromCookies(): Promise<SeekerSession | null> {
  return readSeekerSession((await cookies()).get(SEEKER_COOKIE)?.value);
}
