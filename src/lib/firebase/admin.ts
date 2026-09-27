import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * The private key survives copy-paste differently depending on where it's pasted:
 * locally, Next.js hands us the literal two-character "\n" sequences from .env.local
 * untouched, and we expand them below. On a host's own env var UI (Vercel and friends),
 * a paste can arrive as real line breaks instead, or with the surrounding quote marks
 * accidentally included. Handle all three so this isn't a recurring source of "Failed to
 * parse private key" errors.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  if (key.includes("\\n") && !key.includes("\n")) {
    key = key.replace(/\\n/g, "\n");
  }
  return key;
}

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error("Firebase Admin env vars are missing (see .env.example).");
  }
  const privateKey = normalizePrivateKey(privateKeyRaw);
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("FIREBASE_ADMIN_PRIVATE_KEY doesn't look like a private key - check how it was pasted.");
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export const adminDb = (): Firestore => getFirestore(adminApp());
