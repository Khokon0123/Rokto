import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Hind_Siliguri, Inter } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/components/LocaleProvider";
import SiteFooter from "@/components/SiteFooter";
import { heroStats } from "@/lib/server/stats";
import { accountFromCookies } from "@/lib/server/accountSession";
import SiteHeader from "@/components/SiteHeader";
import { APP_NAME } from "@/config/app";
import { SITE_URL } from "@/config/site";
import { messages } from "@/i18n";
import { requestLocale } from "@/lib/server/metadata";

// Inter: a clean, high-legibility grotesque in the same family as Uber's own typeface (Uber Move) -
// free, and built specifically for UI text at small sizes, which is most of this app.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Anek Bangla: a clean, modern Bengali UI typeface, much more legible at small sizes than the
// default system Bengali fallback. Only Bengali glyphs use it (see --font-sans in globals.css) -
// Latin text keeps rendering in Inter.
const anekBangla = Anek_Bangla({ variable: "--font-anek-bangla", weight: "variable", subsets: ["bengali"] });
// Homepage redesign only: exposed as a CSS variable here, applied by the `font-home` class on the
// homepage. Declaring it does not change any other page's typography.
const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind-siliguri",
  weight: ["400", "500", "600", "700"],
  subsets: ["bengali"],
});

// Absolute base for every generated URL (SITE_URL, from NEXT_PUBLIC_SITE_URL). Without it Next
// emits relative og:image paths, which Facebook, Messenger and WhatsApp all reject.

// The share card is written in Bangla: the people forwarding this link are forwarding it to
// Bangla speakers in Chittagong. The <title> stays English so search results and browser
// tabs keep reading the way they already do.
const OG_TITLE = "\u099a\u099f\u09cd\u099f\u0997\u09cd\u09b0\u09be\u09ae\u09c7 \u09b0\u0995\u09cd\u09a4\u09a6\u09be\u09a4\u09be \u0996\u09c1\u0981\u099c\u09c1\u09a8 | Rokto";
const OG_DESC =
  "\u09b0\u0995\u09cd\u09a4\u09c7\u09b0 \u0997\u09cd\u09b0\u09c1\u09aa \u0993 \u098f\u09b2\u09be\u0995\u09be \u09ac\u09c7\u099b\u09c7 \u09a8\u09bf\u09a8, \u0995\u09be\u099b\u09c7\u09b0 \u09a6\u09be\u09a4\u09be\u0995\u09c7 \u09b8\u09b0\u09be\u09b8\u09b0\u09bf \u0995\u09b2 \u0995\u09b0\u09c1\u09a8\u0964 \u09b8\u09ae\u09cd\u09aa\u09c2\u09b0\u09cd\u09a3 \u09ac\u09bf\u09a8\u09be\u09ae\u09c2\u09b2\u09cd\u09af\u09c7, \u09b2\u0997\u0987\u09a8 \u09ac\u09be \u0985\u09cd\u09af\u09be\u09aa \u09b2\u09be\u0997\u09c7 \u09a8\u09be\u0964";

export async function generateMetadata(): Promise<Metadata> {
  const m = messages[await requestLocale()].meta;
  return {
  metadataBase: new URL(SITE_URL),
  // E4: titles follow the visitor's language; each page adds its own name in front.
  title: { default: m.home, template: `%s | ${APP_NAME}` },
  description: m.description,
  manifest: "/manifest.webmanifest",
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
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await requestLocale();
  // Read here rather than in the homepage so the tiles can live INSIDE the hero band, which
  // then grows to fit them instead of relying on a fixed padding that a longer label overflows.
  // Cheap: both counts sit behind unstable_cache for SEARCH_CACHE_SECONDS and share the
  // "donor-directory" tag, so this is ~one Firestore aggregate per cache period for the whole
  // site, and every route is already server-rendered on demand.
  const stats = await heroStats();
  // Rendered server-side from the cookie so the header never needs a round trip to know who you are.
  const account = await accountFromCookies();

  return (
    // suppressHydrationWarning: browser extensions (coupon/reward tools, translators, password
    // managers) add attributes to <html> and <body> before React loads, which triggers a harmless
    // dev-only mismatch warning. It only covers the element it is on, not its children, so <body>
    // needs its own -- extensions tag that one too (e.g. __processed_<uuid>__="true").
    <html lang={locale} className={`${inter.variable} ${anekBangla.variable} ${hindSiliguri.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <LocaleProvider initialLocale={locale}>
          <SiteHeader stats={stats} account={account} />
          <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-6">{children}</main>
          <SiteFooter />
        </LocaleProvider>
      </body>
    </html>
  );
}
