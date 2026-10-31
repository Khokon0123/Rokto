import { NextResponse } from "next/server";
import { configIssues, isProduction, type Subsystem } from "@/lib/server/env";

// GET /api/health - for uptime monitors (H2/H3). Says WHICH subsystems are configured, never how.
// 200 when everything is ready, 503 otherwise, so a monitor alerts on a broken deploy.
export function GET() {
  const issues = isProduction() ? configIssues() : [];
  const subsystems: Subsystem[] = ["firebase", "otp", "sms", "captcha", "admin", "site"];
  const status = Object.fromEntries(subsystems.map((s) => [s, !issues.some((i) => i.subsystem === s)]));
  const ok = issues.length === 0;
  return NextResponse.json({ ok, subsystems: status }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
