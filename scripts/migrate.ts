/**
 * Usage (from the project folder):
 *   npx tsx --env-file=.env.local scripts/migrate.ts --dry-run   # report only, writes nothing
 *   npx tsx --env-file=.env.local scripts/migrate.ts             # apply
 * Against the emulator instead: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/migrate.ts --dry-run
 * Uses the same FIREBASE_ADMIN_* variables as the app. Prints counts only, never phone numbers in full.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { migrate } from "./migrate-lib";

function app() {
  if (process.env.FIRESTORE_EMULATOR_HOST) return initializeApp({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-rokto" });
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("FIREBASE_ADMIN_* variables are missing (see .env.example).");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const dryRun = process.argv.includes("--dry-run");
migrate(getFirestore(app()), { dryRun })
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    if (report.duplicatePhones.length || report.indexConflicts.length) {
      console.log("\nConflicts found: resolve them in the admin panel (delete the extra profile), then run again.");
      process.exitCode = 2;
    }
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
