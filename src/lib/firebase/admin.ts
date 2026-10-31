import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Rebuilds a well-formed PEM private key from just its base64 body, whatever shape the paste
 * arrived in: literal two-char "\n" sequences (how Next.js hands us .env.local untouched), real
 * line breaks that got flattened into spaces or removed entirely, Windows \r\n, or surrounding
 * quote marks. As long as the actual base64 characters made it through intact, this always
 * produces something the PEM parser can read - the previous version only fixed some of these
 * shapes and kept re-breaking as the key got re-pasted differently each time.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\\n/g, "\n");

  const body = key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  if (!body || !/^[A-Za-z0-9+/=]+$/.test(body) || body.length < 800) {
    throw new Error("FIREBASE_ADMIN_PRIVATE_KEY doesn't look like a complete private key - check how it was pasted.");
  }
  const lines = body.match(/.{1,64}/g) ?? [body];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  // Tests and local e2e run against the Firestore emulator: no credentials, never production data.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-rokto" });
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error("Firebase Admin env vars are missing (see .env.example).");
  }
  const privateKey = normalizePrivateKey(privateKeyRaw);
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export const adminDb = (): Firestore => getFirestore(adminApp());
