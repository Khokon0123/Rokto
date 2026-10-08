import type { Metadata } from "next";

// Carries the page <title> for /team.
export const metadata: Metadata = {
  title: "Team",
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return children;
}
