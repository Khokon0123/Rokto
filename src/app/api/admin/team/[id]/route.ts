import { requireAdmin } from "@/lib/server/adminAuth";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { deleteTeamMember, moveTeamMember, updateTeamMember } from "@/lib/server/team";
import { TEAM_BODY_LIMIT, validateTeamMember } from "@/lib/team";
import { writeAudit } from "@/lib/server/adminDonors";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/team/:id - either { move: "up" | "down" } or the full edited form. Admin-only.
export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) throw new ApiError(400, "bad_request");
    const body = await readJson(req, TEAM_BODY_LIMIT);
    if (body.move === "up" || body.move === "down") {
      await moveTeamMember(id, body.move);
      await writeAudit("team_move", id, req, { direction: body.move });
      return json({ ok: true });
    }
    const result = validateTeamMember(body);
    if ("error" in result) throw new ApiError(400, result.error);
    await updateTeamMember(id, result.fields);
    await writeAudit("team_edit", id, req);
    return json({ ok: true });
  });
}

// DELETE /api/admin/team/:id - remove from /team. Admin-only.
export function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) throw new ApiError(400, "bad_request");
    await readJson(req);
    await deleteTeamMember(id);
    await writeAudit("team_delete", id, req);
    return json({ ok: true });
  });
}
