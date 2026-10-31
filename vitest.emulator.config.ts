import path from "node:path";
import { defineConfig } from "vitest/config";

// Runs inside `firebase emulators:exec` (npm run test:emulator), which sets FIRESTORE_EMULATOR_HOST.
// Never points at a real project: the project id is a demo-* id, which the emulator requires.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "test/support/server-only.ts"),
      "next/cache": path.resolve(__dirname, "test/support/next-cache.ts"),
    },
  },
  test: {
    include: ["test/emulator/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["test/support/emulator-setup.ts"],
  },
});
