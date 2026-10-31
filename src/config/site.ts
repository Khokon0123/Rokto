// L5: the public base URL comes from the environment, so preview deployments don't advertise
// (or generate links to) the production domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.roktoctg.com").replace(/\/$/, "");
