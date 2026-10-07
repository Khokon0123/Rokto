import type { Metadata } from "next";

// team/page.tsx is a Client Component (it reads the current locale), and a Client Component
// can't export `metadata` - this tiny Server Component layout carries the page <title> instead.
export const metadata: Metadata = {
  title: "Team",
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return children;
}
