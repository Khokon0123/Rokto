import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { exportAllDonors, writeAudit } from "@/lib/server/adminDonors";
import { handle } from "@/lib/server/http";
import { sha256 } from "@/lib/server/keys";
import { clientIp } from "@/lib/server/rateLimit";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formulas (=, +, -, @) and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

// GET /api/admin/export?format=json|csv - full donor backup for the weekly routine (H4). Admin-only.
export function GET(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
    const donors = await exportAllDonors();
    await writeAudit("donor_export", format, sha256(clientIp(req)).slice(0, 16), { count: donors.length });
    const stamp = new Date().toISOString().slice(0, 10);
    const headers = {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="rokto-donors-${stamp}.${format}"`,
    };
    if (format === "json") {
      return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), donors }, null, 2), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const cols = ["id", "name", "phone", "bloodGroup", "area", "available", "lastDonated", "lat", "lng", "createdAt"] as const;
    const rows = donors.map((d) =>
      [d.id, d.name, d.phone, d.bloodGroup, d.area, d.available, d.lastDonated, d.location?.lat, d.location?.lng, d.createdAt]
        .map(csvCell)
        .join(","),
    );
    return new NextResponse([cols.join(","), ...rows].join("\r\n"), { headers: { ...headers, "Content-Type": "text/csv" } });
  });
}
