import type { Metadata } from "next";
import { pageMetadata } from "@/lib/server/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("team");
}

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return children;
}
