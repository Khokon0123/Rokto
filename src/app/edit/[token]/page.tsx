import type { Metadata } from "next";
import { pageMetadata } from "@/lib/server/metadata";
import LegacyEditLink from "./LegacyEditLink";

// Old-style links (/edit/<token>) issued before S6 keep working: the browser immediately rewrites
// the address to /edit#<token> so the token doesn't stay in history, then loads the profile.
export async function generateMetadata(): Promise<Metadata> {
  return { ...(await pageMetadata("edit")), robots: { index: false, follow: false } };
}

export default async function LegacyEditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <LegacyEditLink token={token} />;
}
