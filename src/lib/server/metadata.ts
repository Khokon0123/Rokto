import "server-only";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { messages } from "@/i18n";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/locale";

/** The visitor's language from the toggle's cookie (Bangla by default). */
export async function requestLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export type PageKey = Exclude<keyof (typeof messages)["en"]["meta"], "home" | "description">;

/** E4/L5: per-page <title> and description in the visitor's language. */
export async function pageMetadata(page: PageKey): Promise<Metadata> {
  const m = messages[await requestLocale()].meta;
  return { title: m[page], description: m.description };
}
