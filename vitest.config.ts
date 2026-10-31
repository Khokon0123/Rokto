import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "test/support/server-only.ts"),
    },
  },
  test: {
    include: ["test/unit/**/*.test.ts", "test/components/**/*.test.tsx"],
    environment: "node",
    setupFiles: ["test/support/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      // Firestore-bound server modules are exercised by the emulator suite (npm run test:emulator);
      // browser-only helpers (Turnstile, reveal) by the e2e suite.
      exclude: [
        "src/lib/firebase/**",
        "src/lib/server/{donors,adminDonors,directory,directory-core,reports,team,rateLimit,otp,sms,log,metadata,keys}.ts",
        "src/lib/turnstile.ts",
        "src/lib/reveal.ts",
        "src/lib/usePhoneOtp.ts",
        "src/lib/types.ts",
      ],
      reporter: ["text-summary", "text"],
    },
  },
});
