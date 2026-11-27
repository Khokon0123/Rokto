import "server-only";

/**
 * Pre-launch mode. While it is on, the homepage shows the "launching 1 December" page instead of
 * the directory, so a link shared before launch doesn't land on a site that is still being worked
 * on. Donor registration stays open throughout, so the directory has donors on day one.
 *
 * It is an environment variable rather than a constant on purpose: going live on 1 December is
 * deleting PRELAUNCH in the Vercel dashboard and redeploying, with no code change to review.
 */
export function prelaunch(): boolean {
  return process.env.PRELAUNCH === "1";
}
