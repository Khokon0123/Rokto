import { DONATION_COOLDOWN_DAYS } from "@/config/app";
import { DEFAULT_LOCALE, intlLocale, type Locale } from "@/i18n/locale";

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the donor gave blood recently and is probably not ready to donate again. */
export function isCoolingDown(lastDonated: Date | null, now: number = Date.now()): boolean {
  if (!lastDonated) return false;
  return now - lastDonated.getTime() < DONATION_COOLDOWN_DAYS * DAY_MS;
}

/** Dates are stored as UTC midnight, so format in UTC to avoid off-by-one days.
 *  Follows the page language: "12 Jun 2026" in English, "১২ জুন, ২০২৬" in Bangla. */
export function formatDate(d: Date, locale: Locale = DEFAULT_LOCALE): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  };
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), opts).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-GB", opts).format(d);
  }
}
