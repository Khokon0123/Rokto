import type { Metadata } from "next";
import { LAUNCH_DATE } from "@/config/app";
import { pageMetadata } from "@/lib/server/metadata";
import { prelaunch } from "@/lib/server/prelaunch";
import SoonClient from "./SoonClient";

// Refresh hourly so the day count is right without rebuilding; the page has no per-visitor content.
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  // While pre-launch is on this page IS the site, so let it be indexed. Once the directory is
  // back on the homepage, noindex it: Google should not keep offering a "coming soon" page.
  const meta = await pageMetadata("soon");
  return prelaunch() ? meta : { ...meta, robots: { index: false, follow: true } };
}

/**
 * Pre-launch page for the posts going out before 1 December. The real site stays live and
 * working at `/` -- someone who needs blood today must not hit a "coming soon" wall -- so this
 * is a separate page you point the announcement at, and the useful thing it does is take donor
 * registrations, so there are donors in the directory on day one.
 */
export default function SoonPage() {
  // The "already listed, open Rokto" card only makes sense once / is the directory again;
  // in pre-launch mode that link would bounce straight back here.
  return <SoonClient daysLeft={daysUntilLaunch()} showLive={!prelaunch()} />;
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
