import { DONATION_COOLDOWN_DAYS } from "@/config/app";

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the donor gave blood recently and is probably not ready to donate again. */
export function isCoolingDown(lastDonated: Date | null, now: number = Date.now()): boolean {
  if (!lastDonated) return false;
  return now - lastDonated.getTime() < DONATION_COOLDOWN_DAYS * DAY_MS;
}

/** Dates are stored as UTC midnight, so format in UTC to avoid off-by-one days. */
export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
