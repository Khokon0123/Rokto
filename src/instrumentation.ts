// H2: runs once when the server starts. In production, missing or weak configuration stops the
// server here with a clear list, instead of a site that looks healthy while SMS/CAPTCHA are off.
export async function register() {
  // Not during `next build` (prerendering has no runtime secrets): only when the server starts.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { assertProductionConfig } = await import("@/lib/server/env");
    assertProductionConfig();
  }
}
