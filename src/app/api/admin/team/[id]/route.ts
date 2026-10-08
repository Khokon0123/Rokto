import { requireAdmin } from "@/lib/server/adminAuth";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { deleteTeamMember, moveTeamMember, updateTeamMember } from "@/lib/server/team";
import { validateTeamMember } from "@/lib/team";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/team/:id - either { move: "up" | "down" } or the full edited form. Admin-only.
export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    requireAdmin(req);
    const { id } = await params;
    if (!id) throw new ApiError(400, "bad_request");
    const body = await readJson(req);
    if (body.move === "up" || body.move === "down") {
      await moveTeamMember(id, body.move);
      return json({ ok: true });
    }
    const result = validateTeamMember(body);
    if ("error" in result) throw new ApiError(400, result.error);
    await updateTeamMember(id, result.fields);
    return json({ ok: true });
  });
}

// DELETE /api/admin/team/:id - remove from /team. Admin-only.
export function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    requireAdmin(req);
    const { id } = await params;
    if (!id) throw new ApiError(400, "bad_request");
    await deleteTeamMember(id);
    return json({ ok: true });
  });
}
