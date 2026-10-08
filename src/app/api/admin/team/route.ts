import { requireAdmin } from "@/lib/server/adminAuth";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { createTeamMember, listTeam } from "@/lib/server/team";
import { validateTeamMember } from "@/lib/team";

// GET /api/admin/team - everyone on /team, in order. Admin-only.
export function GET(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    return json({ members: await listTeam() });
  });
}

// POST /api/admin/team - add a person. Admin-only.
export function POST(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    const result = validateTeamMember(await readJson(req));
    if ("error" in result) throw new ApiError(400, result.error);
    return json({ member: await createTeamMember(result.fields) });
  });
}
