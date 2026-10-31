import { beforeEach } from "vitest";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Emulator tests must run via `npm run test:emulator` (FIRESTORE_EMULATOR_HOST is not set).");
}
process.env.FIREBASE_ADMIN_PROJECT_ID = "demo-rokto";
process.env.SMS_PROVIDER = "console";

// Wipe the emulator's database before each test (emulator-only REST endpoint).
beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-rokto/databases/(default)/documents`, {
    method: "DELETE",
  });
});
