"use client";

import StatusPage from "@/components/StatusPage";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StatusPage kind="error" onRetry={reset} />;
}
