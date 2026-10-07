import { bn } from "./bn";
import { en, type Messages } from "./en";
import type { Locale } from "./locale";

export type { Messages } from "./en";
export { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locale";

export const messages: Record<Locale, Messages> = { en, bn };

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export function getErrorMessage(locale: Locale, code: string | undefined): string {
  const errors = messages[locale].errors as Record<string, string>;
  return (code && errors[code]) || errors.generic;
}
