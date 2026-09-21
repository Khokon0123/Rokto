import "server-only";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import {
  OTP_DEFAULT_DAILY_CAP,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_IP_PER_HOUR,
  OTP_MAX_PER_PHONE_PER_HOUR,
  OTP_PROOF_TTL_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
} from "@/config/app";
import { adminDb } from "@/lib/firebase/admin";
import { normalizeBdPhone } from "@/lib/phone";
import { verifyCaptcha } from "./captcha";
import { ApiError } from "./http";
import { hit } from "./rateLimit";
import { sendOtpSms } from "./sms";

// otpChallenges/{sha256(phone)}  PRIVATE: HMAC of the active code, expiry, wrong-guess counter.
// The code itself is never stored. Phone verification produces a signed, short-lived "proof"
// that the register / recover / phone-change endpoints accept instead of any login session.
const CHALLENGES = "otpChallenges";

function secret(): string {
  const s = process.env.OTP_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return "dev-only-secret-dev-only-secret-dev-only";
  throw new ApiError(503, "sms_unavailable"); // refuse to run in production without a real secret
}

const hmac = (data: string) => createHmac("sha256", secret()).update(data).digest();
const b64 = (buf: Buffer) => buf.toString("base64url");

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

const challengeRef = (phone: string) =>
  adminDb().collection(CHALLENGES).doc(createHash("sha256").update(phone).digest("hex"));

function parsePhone(input: unknown): string {
  const phone = typeof input === "string" ? normalizeBdPhone(input) : null;
  if (!phone) throw new ApiError(400, "phone_invalid");
  return phone;
}

/** Step 1: text a fresh 6-digit code. Heavily rate limited because every SMS costs money. */
export async function startOtp(input: { phone: unknown; captcha: unknown; ip: string }): Promise<void> {
  const phone = parsePhone(input.phone);
  await verifyCaptcha(input.captcha, input.ip);

  // Cheap guards first: cooldown, then per-phone, per-IP and overall daily caps.
  const existing = await challengeRef(phone).get();
  const sentAt = existing.data()?.sentAt as number | undefined;
  if (sentAt && Date.now() - sentAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    throw new ApiError(429, "otp_wait");
  }
  await hit(`otp:phone:${phone}`, OTP_MAX_PER_PHONE_PER_HOUR, 3600);
  await hit(`otp:ip:${input.ip}`, OTP_MAX_PER_IP_PER_HOUR, 3600);
  const cap = Number(process.env.OTP_DAILY_CAP) || OTP_DEFAULT_DAILY_CAP;
  await hit(`otp:day:${new Date().toISOString().slice(0, 10)}`, cap, 86400);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const ref = challengeRef(phone);
  await ref.set({
    codeHash: hmac(`${phone}:${code}`).toString("hex"),
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    attempts: 0,
    sentAt: Date.now(),
  });

  try {
    await sendOtpSms(phone, code, Math.round(OTP_TTL_SECONDS / 60));
  } catch (e) {
    await ref.delete().catch(() => undefined); // nothing was delivered, don't leave a live code
    throw e;
  }
}

/** Step 2: check the code. On success returns a signed proof that this phone was just verified. */
export async function finishOtp(input: { phone: unknown; code: unknown }): Promise<{ proof: string }> {
  const phone = parsePhone(input.phone);
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, "otp_wrong");

  const ref = challengeRef(phone);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { codeHash: string; expiresAt: number; attempts: number } | undefined;
    if (!data || Date.now() > data.expiresAt) throw new ApiError(400, "otp_expired");
    if (data.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, "otp_locked");

    const ok = safeEqual(hmac(`${phone}:${code}`), Buffer.from(data.codeHash, "hex"));
    if (!ok) {
      tx.update(ref, { attempts: data.attempts + 1 });
      // Throwing would roll the counter back, so signal the miss after the transaction commits.
      return "wrong" as const;
    }
    tx.delete(ref); // single use
    return "ok" as const;
  }).then((outcome) => {
    if (outcome === "wrong") throw new ApiError(400, "otp_wrong");
  });

  return { proof: signProof(phone) };
}

function signProof(phone: string): string {
  const payload = b64(Buffer.from(JSON.stringify({ phone, exp: Date.now() + OTP_PROOF_TTL_SECONDS * 1000 })));
  return `${payload}.${b64(hmac(`proof:${payload}`))}`;
}

/** Used by /api/donors, /api/recover and /api/edit: returns the phone this proof vouches for. */
export function verifyPhoneProof(proof: unknown): { phone: string } {
  if (typeof proof !== "string") throw new ApiError(401, "otp_invalid");
  const [payload, sig] = proof.split(".");
  if (!payload || !sig) throw new ApiError(401, "otp_invalid");
  if (!safeEqual(hmac(`proof:${payload}`), Buffer.from(sig, "base64url"))) throw new ApiError(401, "otp_invalid");
  let data: { phone?: string; exp?: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(401, "otp_invalid");
  }
  if (!data.exp || Date.now() > data.exp) throw new ApiError(401, "otp_expired");
  const phone = data.phone ? normalizeBdPhone(data.phone) : null;
  if (!phone) throw new ApiError(401, "otp_invalid");
  return { phone };
}
