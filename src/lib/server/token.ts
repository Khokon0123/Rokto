import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256 bits of randomness, URL-safe (43 chars). This is the sole credential for /edit/[token]. */
export function generateEditToken(): string {
  return randomBytes(32).toString("base64url");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Only this hash is stored (in the private `donorSecrets` collection), never the token itself. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
