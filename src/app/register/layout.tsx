import type { Metadata } from "next";
import { pageMetadata } from "@/lib/server/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("register");
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
