import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

// Component tests render with next/navigation unavailable; give them a harmless router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  // SearchClient seeds its filters from the query string. Tests render it with no params, which
  // is the "plain /search" case; a test that wants a shared link can stub this per-file.
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(async () => {
  vi.unstubAllEnvs();
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});
