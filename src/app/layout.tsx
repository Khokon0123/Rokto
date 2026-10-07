import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { LocaleProvider } from "@/components/LocaleProvider";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { APP_NAME } from "@/config/app";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/locale";

// Inter: a clean, high-legibility grotesque in the same family as Uber's own typeface (Uber Move) -
// free, and built specifically for UI text at small sizes, which is most of this app.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Anek Bangla: a clean, modern Bengali UI typeface, much more legible at small sizes than the
// default system Bengali fallback. Only Bengali glyphs use it (see --font-sans in globals.css) -
// Latin text keeps rendering in Inter.
const anekBangla = Anek_Bangla({ variable: "--font-anek-bangla", weight: "variable", subsets: ["bengali"] });

export const metadata: Metadata = {
  title: `${APP_NAME} - Find a blood donor in Chittagong`,
  description: "Search available blood donors by blood group and area in Chittagong, Bangladesh. No login needed.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return (
    // suppressHydrationWarning: browser extensions (coupon/reward tools, translators) add attributes to <html>
    // before React loads, which triggers a harmless dev-only mismatch warning.
    <html lang={locale} className={`${inter.variable} ${anekBangla.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <LocaleProvider initialLocale={locale}>
          <SiteHeader />
          <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-6">{children}</main>
          <SiteFooter />
        </LocaleProvider>
      </body>
    </html>
  );
}
