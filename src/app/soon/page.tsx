import type { Metadata } from "next";
import { LAUNCH_DATE } from "@/config/app";
import { pageMetadata } from "@/lib/server/metadata";
import SoonClient from "./SoonClient";

// Refresh hourly so the day count is right without rebuilding; the page has no per-visitor content.
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  // Not in the sitemap and noindex: this is a page to hand out in posts before launch, not one
  // Google should start showing instead of the homepage.
  return { ...(await pageMetadata("soon")), robots: { index: false, follow: true } };
}

/**
 * Pre-launch page for the posts going out before 1 December. The real site stays live and
 * working at `/` -- someone who needs blood today must not hit a "coming soon" wall -- so this
 * is a separate page you point the announcement at, and the useful thing it does is take donor
 * registrations, so there are donors in the directory on day one.
 */
export default function SoonPage() {
  return <SoonClient daysLeft={daysUntilLaunch()} />;
}

/**
 * Whole days from today to launch day, counted on Bangladesh's calendar (UTC+6) rather than the
 * server's, so the number ticks over at midnight in Chittagong. 0 means launch day or later.
 */
function daysUntilLaunch(): number {
  const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  // Shifting by the offset turns "midnight in Dhaka" into "midnight UTC", so flooring to whole
  // days gives the Bangladeshi calendar date on both sides of the subtraction.
  const todayBd = Math.floor((Date.now() + BD_OFFSET_MS) / DAY_MS);
  const launchBd = Math.floor(Date.parse(`${LAUNCH_DATE}T00:00:00Z`) / DAY_MS);
  return Math.max(0, launchBd - todayBd);
}
