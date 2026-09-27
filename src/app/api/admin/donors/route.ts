import { requireAdmin } from "@/lib/server/adminAuth";
import { listAllDonors } from "@/lib/server/donors";
import { handle, json } from "@/lib/server/http";

// GET /api/admin/donors - every donor, every field, no availability/limit filtering. Admin-only.
export function GET(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    const donors = await listAllDonors();
    return json({
      donors: donors.map((d) => ({
        ...d,
        lastDonated: d.lastDonated ? d.lastDonated.toISOString().slice(0, 10) : null,
        createdAt: d.createdAt ? d.createdAt.toISOString() : null,
      })),
    });
  });
}
