export type Locale = "bn" | "en";

// Bangla by default: this is a Bangladeshi, Chittagong-focused app. English is an explicit
// opt-in via the toggle in the header.
export const DEFAULT_LOCALE: Locale = "bn";
export const LOCALE_COOKIE = "rokto_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "bn" || value === "en";
}

/** The BCP-47 tag to hand Intl. Bengali formatting gives Bangla digits and month names
 *  ("১২ জুন, ২০২৬", "২.৪ কিমি") - without this every number on a Bangla page renders in
 *  Latin digits, which is what made dates and distances the odd ones out. */
export function intlLocale(locale: Locale): string {
  return locale === "bn" ? "bn-BD" : "en-GB";
}

/** Plain number in the page's own digits. */
export function formatNumber(n: number, locale: Locale): string {
  try {
    return new Intl.NumberFormat(intlLocale(locale)).format(n);
  } catch {
    return String(n); // a browser without Bengali locale data still shows something sane
  }
}
