import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run the real app against the Firestore emulator with SMS_PROVIDER=console
// (codes land in an outbox file the tests read). Start with: npm run test:e2e
const PORT = 3210;
// Outside the project: a file changing inside it would make `next dev` reload the page mid-test.
export const OUTBOX = path.join(os.tmpdir(), "rokto-e2e-sms-outbox.jsonl");

export default defineConfig({
  testDir: "test/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080",
      FIREBASE_ADMIN_PROJECT_ID: "demo-rokto",
      SMS_PROVIDER: "console",
      E2E_SMS_OUTBOX: OUTBOX,
      ADMIN_PASSWORD: "e2e-admin-password-123",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
