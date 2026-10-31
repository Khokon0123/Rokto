import type { Metadata } from "next";
import { pageMetadata } from "@/lib/server/metadata";
import EditFromFragment from "./EditFromFragment";

// The token is in the URL #fragment (S6), so the server never sees it: the page is static and
// the browser reads the fragment. Kept out of search results either way.
export async function generateMetadata(): Promise<Metadata> {
  return { ...(await pageMetadata("edit")), robots: { index: false, follow: false } };
}

export default function EditPage() {
  return <EditFromFragment />;
}
