import { listTeamCached } from "@/lib/server/team";
import { logError } from "@/lib/server/log";
import type { TeamMember } from "@/lib/team";
import TeamClient from "./TeamClient";

// D7: cached (5 min) and refreshed instantly whenever the admin panel changes the team, instead of
// a Firestore transaction on every page view.
export const revalidate = 300;

export default async function TeamPage() {
  let members: TeamMember[] | null;
  try {
    members = await listTeamCached();
  } catch (e) {
    // Don't paper over an outage with stale hard-coded defaults: log it, say so on the page.
    logError("team_load_failed", e);
    members = null;
  }
  return <TeamClient members={members} />;
}
