import type { Metadata } from "next";
import { pageMetadata } from "@/lib/server/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("search");
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
