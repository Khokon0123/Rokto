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

// Absolute base for every generated URL. Without it Next emits relative og:image paths,
// which Facebook, Messenger and WhatsApp all reject - and with no og:image at all they fall
// back to scraping whatever picture is on the page, which is how a partner logo in the
// footer ended up as the link preview.
const SITE_URL = "https://www.roktoctg.com";

// The share card is written in Bangla: the people forwarding this link are forwarding it to
// Bangla speakers in Chittagong. The <title> stays English so search results and browser
// tabs keep reading the way they already do.
const OG_TITLE = "\u099a\u099f\u09cd\u099f\u0997\u09cd\u09b0\u09be\u09ae\u09c7 \u09b0\u0995\u09cd\u09a4\u09a6\u09be\u09a4\u09be \u0996\u09c1\u0981\u099c\u09c1\u09a8 | Rokto";
const OG_DESC =
  "\u09b0\u0995\u09cd\u09a4\u09c7\u09b0 \u0997\u09cd\u09b0\u09c1\u09aa \u0993 \u098f\u09b2\u09be\u0995\u09be \u09ac\u09c7\u099b\u09c7 \u09a8\u09bf\u09a8, \u0995\u09be\u099b\u09c7\u09b0 \u09a6\u09be\u09a4\u09be\u0995\u09c7 \u09b8\u09b0\u09be\u09b8\u09b0\u09bf \u0995\u09b2 \u0995\u09b0\u09c1\u09a8\u0964 \u09b8\u09ae\u09cd\u09aa\u09c2\u09b0\u09cd\u09a3 \u09ac\u09bf\u09a8\u09be\u09ae\u09c2\u09b2\u09cd\u09af\u09c7, \u09b2\u0997\u0987\u09a8 \u09ac\u09be \u0985\u09cd\u09af\u09be\u09aa \u09b2\u09be\u0997\u09c7 \u09a8\u09be\u0964";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${APP_NAME} - Find a blood donor in Chittagong`,
  description: "Search available blood donors by blood group and area in Chittagong, Bangladesh. No login needed.",
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    url: SITE_URL,
    title: OG_TITLE,
    description: OG_DESC,
    locale: "bn_BD",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: OG_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESC,
    images: ["/og.png"],
  },
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
