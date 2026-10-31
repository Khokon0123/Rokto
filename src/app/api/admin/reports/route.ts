import { requireAdmin } from "@/lib/server/adminAuth";
import { handle, json } from "@/lib/server/http";
import { listOpenReports } from "@/lib/server/reports";

// GET /api/admin/reports - open "Report this listing" submissions (L2). Admin-only.
export function GET(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    return json({ reports: await listOpenReports() });
  });
}
