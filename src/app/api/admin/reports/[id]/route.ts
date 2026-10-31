import { requireAdmin } from "@/lib/server/adminAuth";
import { writeAudit } from "@/lib/server/adminDonors";
import { handle, json, readJson } from "@/lib/server/http";
import { sha256 } from "@/lib/server/keys";
import { clientIp } from "@/lib/server/rateLimit";
import { closeReport } from "@/lib/server/reports";

// PATCH /api/admin/reports/:id { dismiss: true } - close a report without action. Admin-only.
export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireAdmin(req);
    const { id } = await params;
    await readJson(req);
    await closeReport(id, "dismissed");
    await writeAudit("report_dismiss", id, sha256(clientIp(req)).slice(0, 16));
    return json({ ok: true });
  });
}
