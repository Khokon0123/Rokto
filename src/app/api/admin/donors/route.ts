import { requireAdmin } from "@/lib/server/adminAuth";
import { listDonorsPage } from "@/lib/server/adminDonors";
import { handle, json } from "@/lib/server/http";

// GET /api/admin/donors?group=&area=&phone=&cursor= - one page, newest first (H7). Admin-only.
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const q = new URL(req.url).searchParams;
    return json(
      await listDonorsPage({
        bloodGroup: q.get("group") ?? undefined,
        area: q.get("area") ?? undefined,
        phone: q.get("phone") ?? undefined,
        cursor: q.get("cursor") ?? undefined,
      }),
    );
  });
}
