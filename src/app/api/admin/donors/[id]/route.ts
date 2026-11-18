import { requireAdmin } from "@/lib/server/adminAuth";
import { writeAudit } from "@/lib/server/adminDonors";
import { deleteDonorById } from "@/lib/server/donors";
import { ApiError, handle, json, readJson } from "@/lib/server/http";
import { closeReport } from "@/lib/server/reports";

// DELETE /api/admin/donors/:id { block?: boolean, reportId?: string } - permanent. Admin-only.
// block=true also stops that phone number from registering again (L2).
export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin(req);
    const { id } = await params;
    if (!id || !/^[A-Za-z0-9]{1,40}$/.test(id)) throw new ApiError(400, "bad_request");
    const body = await readJson(req);
    const block = body.block === true;
    const { deleted } = await deleteDonorById(id, block ? { reason: "admin" } : null);
    if (!deleted) throw new ApiError(404, "not_found");
    if (typeof body.reportId === "string") await closeReport(body.reportId, "deleted").catch(() => undefined);
    await writeAudit(block ? "donor_delete_block" : "donor_delete", id, req);
    return json({ ok: true });
  });
}
