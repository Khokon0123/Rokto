import { DEFAULT_TEAM } from "@/config/app";
import { listTeam } from "@/lib/server/team";
import type { TeamMember } from "@/lib/team";
import TeamClient from "./TeamClient";

// Always read fresh, so people added in /admin show up immediately.
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  let members: TeamMember[];
  try {
    members = await listTeam();
  } catch (e) {
    // Firestore unreachable or not configured (e.g. local dev without keys): show the starting team.
    console.error(e);
    members = DEFAULT_TEAM.map((m, i) => ({ ...m, id: `default-${i}`, order: i }));
  }
  return <TeamClient members={members} />;
}
