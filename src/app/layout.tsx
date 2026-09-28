import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { APP_NAME } from "@/config/app";

// Inter: a clean, high-legibility grotesque in the same family as Uber's own typeface (Uber Move) -
// free, and built specifically for UI text at small sizes, which is most of this app.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${APP_NAME} - Find a blood donor in Chittagong`,
  description: "Search available blood donors by blood group and area in Chittagong, Bangladesh. No login needed.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (coupon/reward tools, translators) add attributes to <html>
    // before React loads, which triggers a harmless dev-only mismatch warning.
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-6">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
