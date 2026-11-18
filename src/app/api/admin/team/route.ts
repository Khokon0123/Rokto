import { requireAdmin } from "@/lib/server/adminAuth";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { createTeamMember, isTeamSeeded, listTeam } from "@/lib/server/team";
import { writeAudit } from "@/lib/server/adminDonors";
import { TEAM_BODY_LIMIT, validateTeamMember } from "@/lib/team";

// GET /api/admin/team - everyone on /team, in order. Admin-only.
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const [members, seeded] = await Promise.all([listTeam(), isTeamSeeded()]);
    return json({ members, seeded });
  });
}

// POST /api/admin/team - add a person. Admin-only.
export function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const result = validateTeamMember(await readJson(req, TEAM_BODY_LIMIT));
    if ("error" in result) throw new ApiError(400, result.error);
    const member = await createTeamMember(result.fields);
    await writeAudit("team_add", member.id, req);
    return json({ member });
  });
}
