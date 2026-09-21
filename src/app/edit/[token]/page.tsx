import type { Metadata } from "next";
import EditClient from "./EditClient";

// The URL is the credential: keep it out of search results.
export const metadata: Metadata = { title: "Your donor profile", robots: { index: false, follow: false } };

export default async function EditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <EditClient token={token} />;
}
