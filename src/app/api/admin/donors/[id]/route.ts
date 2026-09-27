import { requireAdmin } from "@/lib/server/adminAuth";
import { deleteDonor } from "@/lib/server/donors";
import { ApiError, handle, json } from "@/lib/server/http";

// DELETE /api/admin/donors/:id - permanent. Admin-only.
export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireAdmin(req);
    const { id } = await params;
    if (!id) throw new ApiError(400, "bad_request");
    await deleteDonor(id);
    return json({ ok: true });
  });
}
