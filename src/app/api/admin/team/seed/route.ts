import { requireAdmin } from "@/lib/server/adminAuth";
import { writeAudit } from "@/lib/server/adminDonors";
import { handle, json, readJson } from "@/lib/server/http";
import { sha256 } from "@/lib/server/keys";
import { clientIp } from "@/lib/server/rateLimit";
import { seedTeam } from "@/lib/server/team";

// POST /api/admin/team/seed - copy the starting team (config/app.ts) in, once (D7). Admin-only.
export function POST(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    await readJson(req);
    const seeded = await seedTeam();
    if (seeded) await writeAudit("team_seed", "team", sha256(clientIp(req)).slice(0, 16));
    return json({ seeded });
  });
}
