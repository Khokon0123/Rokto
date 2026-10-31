import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/server/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("terms");
}

export default function Page() {
  return <LegalPage kind="terms" />;
}
