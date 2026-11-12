import "server-only";
import { cookies } from "next/headers";
import { readAccountSession, ACCOUNT_COOKIE, type AccountSession } from "./accountAuth";

// Kept apart from accountAuth.ts on purpose: that module is pure crypto and is unit-tested outside
// Next, and importing next/headers there would drag a request scope into those tests.

/** The signed-in account, for server components (the layout renders the header from this). */
export async function accountFromCookies(): Promise<AccountSession | null> {
  return readAccountSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
}
