"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { getErrorMessage, messages, type Locale, type Messages } from "@/i18n";
import { LOCALE_COOKIE } from "@/i18n/locale";

interface LocaleContextValue {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
  errorMessage: (code: string | undefined) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Wraps the whole app. Everything that needs copy or the current language reads it from here
 * via useT()/useLocale()/useErrorMessage(), rather than a static import - the whole app is
 * client-rendered copy-wise so a Server Component (DonorCard) can still be rendered from inside
 * a Client Component (SearchClient) without Next.js complaining.
 */
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      // 1 year, readable on every path - next request's Server Components (layout) pick this up
      // so the correct language renders on first paint instead of flashing the old one.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* cookies blocked: the toggle still works for this visit, it just won't persist */
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: messages[locale],
      setLocale,
      errorMessage: (code: string | undefined) => getErrorMessage(locale, code),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale/useT/useErrorMessage must be used inside <LocaleProvider>");
  return ctx;
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const { locale, setLocale } = useLocaleContext();
  return { locale, setLocale };
}

export function useT(): Messages {
  return useLocaleContext().t;
}

export function useErrorMessage(): (code: string | undefined) => string {
  return useLocaleContext().errorMessage;
}
