// H2: runs once when the server starts. In production, missing or weak configuration stops the
// server here with a clear list, instead of a site that looks healthy while SMS/CAPTCHA are off.
export async function register() {
  // Not during `next build` (prerendering has no runtime secrets): only when the server starts.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    // Preview deployments build with NODE_ENV=production, but their secrets live in Vercel's
    // Production scope and are deliberately absent here, so this guard would 500 every route on
    // every branch preview. VERCEL_ENV separates the real site ("production") from a branch
    // preview ("preview"); only the real site has to fail fast.
    // NB: isProduction() is left alone on purpose. It also gates the dev fallbacks in otp.ts and
    // adminAuth.ts (hardcoded secrets, 8-character passwords, non-secure cookies). Relaxing that
    // instead would leave a PUBLIC preview URL far less safe than a 500 ever was.
    if (process.env.VERCEL_ENV === "preview") return;
    const { assertProductionConfig } = await import("@/lib/server/env");
    assertProductionConfig();
  }
}
