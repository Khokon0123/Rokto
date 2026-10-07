export type Locale = "bn" | "en";

// Bangla by default: this is a Bangladeshi, Chittagong-focused app. English is an explicit
// opt-in via the toggle in the header.
export const DEFAULT_LOCALE: Locale = "bn";
export const LOCALE_COOKIE = "rokto_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "bn" || value === "en";
}
