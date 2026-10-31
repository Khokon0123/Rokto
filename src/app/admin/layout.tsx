import type { Metadata } from "next";
import { pageMetadata } from "@/lib/server/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return { ...(await pageMetadata("admin")), robots: { index: false, follow: false } };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
