import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Timestamp, type Transaction } from "firebase-admin/firestore";
import {
  OTP_DEFAULT_DAILY_CAP,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_FAILED_PER_PHONE_PER_DAY,
  OTP_MAX_PER_IP_PER_DAY,
  OTP_MAX_PER_IP_PER_HOUR,
  OTP_MAX_PER_PHONE_PER_HOUR,
  OTP_MAX_PER_SUBNET_PER_DAY,
  OTP_PROOF_TTL_SECONDS,
  OTP_RECOVER_SHARE,
  OTP_SIGNIN_SHARE,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  PROOF_MAX_USES,
} from "@/config/app";
import { dhakaDate } from "@/lib/dates";
import { onlyDigits } from "@/lib/digits";
import { adminDb } from "@/lib/firebase/admin";
import { normalizeBdPhone } from "@/lib/phone";
import { verifyCaptcha } from "./captcha";
import { isProduction } from "./env";
import { ApiError } from "./http";
import { COL, phoneKey, sha256 } from "./keys";
import { alert, log, maskPhone } from "./log";
import { check, hit, refund, subnetOf } from "./rateLimit";
import { sendOtpSms } from "./sms";

// otpChallenges/{sha256(phone)}  PRIVATE: HMAC of the active code, its random challengeId, purpose,
// expiry and wrong-guess counter. The code itself is never stored. A correct code yields a signed,
// purpose-bound, short-lived "proof" that one endpoint (register / recover / change_phone) accepts.

export const OTP_PURPOSES = ["register", "recover", "change_phone", "signin"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export function secret(): string {
  const s = process.env.OTP_SECRET;
  if (s && s.length >= 32) return s;
  if (!isProduction()) return "dev-only-secret-dev-only-secret-dev-only";
  throw new ApiError(503, "sms_unavailable"); // refuse to run in production without a real secret
}

const hmac = (data: string) => createHmac("sha256", secret()).update(data).digest();
const b64 = (buf: Buffer) => buf.toString("base64url");
const safeEqual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
const challengeRef = (phone: string) => adminDb().collection(COL.challenges).doc(phoneKey(phone));
const phoneHourKey = (phone: string) => `otp:phone:${phone}`;

function parsePhone(input: unknown): string {
  const phone = typeof input === "string" ? normalizeBdPhone(input) : null;
  if (!phone) throw new ApiError(400, "phone_invalid");
  return phone;
}

export function parsePurpose(input: unknown): OtpPurpose {
  if (typeof input === "string" && (OTP_PURPOSES as readonly string[]).includes(input)) return input as OtpPurpose;
  throw new ApiError(400, "bad_request");
}

/** OTP_DAILY_CAP as a number; 0 is a real value (stop all SMS), not "use the default" (D6). */
export function dailyCap(): number {
  const raw = process.env.OTP_DAILY_CAP;
  if (raw === undefined || raw.trim() === "") return OTP_DEFAULT_DAILY_CAP;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : OTP_DEFAULT_DAILY_CAP;
}

/** Separate budgets so no one purpose can starve the others (S3). Registration keeps whatever is
 *  left after recovery and sign-in, because a donor who cannot register is the worst failure. */
export function budgetFor(purpose: OtpPurpose, cap: number): { key: string; limit: number } {
  const recover = Math.ceil(cap * OTP_RECOVER_SHARE);
  const signin = Math.ceil(cap * OTP_SIGNIN_SHARE);
  const day = dhakaDate();
  if (purpose === "recover") return { key: `otp:day:${day}:recover`, limit: recover };
  if (purpose === "signin") return { key: `otp:day:${day}:signin`, limit: signin };
  return { key: `otp:day:${day}:main`, limit: Math.max(0, cap - recover - signin) };
}

async function chargeDailyBudget(purpose: OtpPurpose): Promise<string> {
  const cap = dailyCap();
  if (cap === 0) throw new ApiError(503, "sms_unavailable");
  const { key, limit } = budgetFor(purpose, cap);
  const count = await hit(key, limit, 86_400, "sms_unavailable").catch(async (e) => {
    if (e instanceof ApiError) await alert(`SMS daily budget for "${purpose}" is used up (${limit}/day).`);
    throw e;
  });
  for (const share of [0.5, 0.8]) {
    if (count === Math.ceil(limit * share)) {
      await alert(`SMS daily budget for "${purpose}" is ${share * 100}% used (${count}/${limit}).`);
    }
  }
  return key;
}

async function assertNotBlocked(phone: string): Promise<void> {
  const snap = await adminDb().collection(COL.blocked).doc(phoneKey(phone)).get();
  if (snap.exists) throw new ApiError(403, "phone_blocked");
}

/**
 * Step 1: text a fresh 6-digit code. Order matters (S3): CAPTCHA, then the IP limits, then the
 * global daily budget, then (atomically with creating the challenge) cooldown + per-phone limit.
 * A request stopped by an IP limit therefore never touches the victim phone's budget.
 */
export async function startOtp(input: {
  phone: unknown;
  captcha: unknown;
  ip: string;
  purpose: unknown;
  locale?: "bn" | "en";
}): Promise<{ challengeId: string }> {
  const phone = parsePhone(input.phone);
  const purpose = parsePurpose(input.purpose);
  await assertNotBlocked(phone);
  await verifyCaptcha(input.captcha, input.ip, "otp_send");

  await hit(`otp:ip:${input.ip}`, OTP_MAX_PER_IP_PER_HOUR, 3600);
  await hit(`otp:ipday:${input.ip}`, OTP_MAX_PER_IP_PER_DAY, 86_400);
  await hit(`otp:subnet:${subnetOf(input.ip)}`, OTP_MAX_PER_SUBNET_PER_DAY, 86_400);
  const dayKey = await chargeDailyBudget(purpose);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  let challengeId: string;
  try {
    challengeId = await createChallenge(phone, purpose, code);
  } catch (e) {
    await refund(dayKey);
    throw e;
  }

  try {
    await sendOtpSms(phone, code, Math.round(OTP_TTL_SECONDS / 60), input.locale);
  } catch (e) {
    await Promise.all([dropChallengeIfOwn(phone, challengeId), refund(dayKey), refund(phoneHourKey(phone))]);
    throw e;
  }
  log("info", "otp_sent", { purpose, phone: maskPhone(phone) });
  return { challengeId };
}

/** D4: cooldown, per-phone hourly limit and the new challenge, all in one transaction. */
async function createChallenge(phone: string, purpose: OtpPurpose, code: string): Promise<string> {
  const db = adminDb();
  const ref = challengeRef(phone);
  // Same id scheme as rateLimit.ts, so hit()/refund() and this in-transaction counter agree.
  const limitRef = db.collection("rateLimits").doc(sha256(phoneHourKey(phone)));
  const challengeId = b64(randomBytes(16));
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const [existing, counter] = await Promise.all([tx.get(ref), tx.get(limitRef)]);
    const sentAt = existing.data()?.sentAt as number | undefined;
    if (sentAt && now - sentAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) throw new ApiError(429, "otp_wait");

    const c = counter.data() as { count: number; windowStart: number } | undefined;
    const fresh = !c || now - c.windowStart >= 3_600_000;
    const count = fresh ? 0 : c.count;
    if (count >= OTP_MAX_PER_PHONE_PER_HOUR) throw new ApiError(429, "rate_limited");
    const windowStart = fresh ? now : c.windowStart;
    tx.set(limitRef, { count: count + 1, windowStart, expireAt: Timestamp.fromMillis(windowStart + 3_600_000) });

    tx.set(ref, {
      challengeId,
      purpose,
      codeHash: hmac(`${phone}:${challengeId}:${code}`).toString("hex"),
      expiresAt: now + OTP_TTL_SECONDS * 1000,
      expireAt: Timestamp.fromMillis(now + OTP_TTL_SECONDS * 1000),
      attempts: 0,
      sentAt: now,
    });
  });
  return challengeId;
}

/** Deletes the challenge only if it is still the one this request created (D4). */
async function dropChallengeIfOwn(phone: string, challengeId: string): Promise<void> {
  const db = adminDb();
  const ref = challengeRef(phone);
  await db
    .runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.data()?.challengeId === challengeId) tx.delete(ref);
    })
    .catch(() => undefined);
}


/** Step 2: check the code. On success returns a signed, purpose-bound proof. */
export async function finishOtp(input: {
  phone: unknown;
  code: unknown;
  challengeId: unknown;
  purpose: unknown;
}): Promise<{ proof: string; phone: string; purpose: OtpPurpose }> {
  const phone = parsePhone(input.phone);
  const purpose = parsePurpose(input.purpose);
  const code = typeof input.code === "string" ? onlyDigits(input.code) : ""; // E1: ০-৯ welcome
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, "otp_wrong");
  if (typeof input.challengeId !== "string" || input.challengeId.length > 64) throw new ApiError(400, "otp_expired");

  const failKey = `otp:fail:${phone}:${dhakaDate()}`;
  await check(failKey, OTP_MAX_FAILED_PER_PHONE_PER_DAY, 86_400, "otp_locked"); // S13

  const ref = challengeRef(phone);
  const outcome = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as
      | { codeHash: string; expiresAt: number; attempts: number; challengeId: string; purpose: string }
      | undefined;
    if (!data || Date.now() > data.expiresAt || data.challengeId !== input.challengeId) {
      throw new ApiError(400, "otp_expired");
    }
    if (data.purpose !== purpose) throw new ApiError(400, "otp_expired");
    if (data.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, "otp_locked");

    const ok = safeEqual(hmac(`${phone}:${data.challengeId}:${code}`), Buffer.from(data.codeHash, "hex"));
    if (!ok) {
      tx.update(ref, { attempts: data.attempts + 1 });
      return "wrong" as const; // throwing here would roll the counter back
    }
    tx.delete(ref); // single use
    return "ok" as const;
  });
  if (outcome === "wrong") {
    await hit(failKey, Number.MAX_SAFE_INTEGER, 86_400);
    throw new ApiError(400, "otp_wrong");
  }
  const proof = signProof({ phone, purpose, jti: b64(randomBytes(16)), exp: Date.now() + OTP_PROOF_TTL_SECONDS * 1000 });
  return { proof, phone, purpose };
}

export interface ProofData {
  phone: string;
  purpose: OtpPurpose;
  jti: string;
  exp: number;
}

export function signProof(data: ProofData): string {
  const payload = b64(Buffer.from(JSON.stringify(data)));
  return `${payload}.${b64(hmac(`proof:${payload}`))}`;
}

/** Verifies signature, expiry and purpose. The phone always comes from here, never the request. */
export function verifyPhoneProof(proof: unknown, purpose: OtpPurpose): ProofData {
  if (typeof proof !== "string" || proof.length > 1024) throw new ApiError(401, "otp_invalid");
  const [payload, sig] = proof.split(".");
  if (!payload || !sig) throw new ApiError(401, "otp_invalid");
  if (!safeEqual(hmac(`proof:${payload}`), Buffer.from(sig, "base64url"))) throw new ApiError(401, "otp_invalid");
  let data: Partial<ProofData>;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(401, "otp_invalid");
  }
  if (!data.exp || Date.now() > data.exp) throw new ApiError(401, "otp_expired");
  if (data.purpose !== purpose || typeof data.jti !== "string") throw new ApiError(401, "otp_invalid");
  const phone = data.phone ? normalizeBdPhone(data.phone) : null;
  if (!phone) throw new ApiError(401, "otp_invalid");
  return { phone, purpose, jti: data.jti, exp: data.exp };
}

/**
 * S11: a proof is single-purpose, and repeat use is only an IDEMPOTENT RETRY of the same action on
 * the same subject (F9: "Couldn't save, try again" must not need another SMS). Call inside the
 * caller's transaction, in its read phase; call the returned `commit` in its write phase.
 */
export async function claimProof(tx: Transaction, proof: ProofData, subject: string): Promise<{ commit: () => void }> {
  const ref = adminDb().collection(COL.usedProofs).doc(proof.jti);
  const snap = await tx.get(ref);
  const used = snap.data() as { purpose: string; subject: string; uses: number } | undefined;
  if (used && (used.purpose !== proof.purpose || used.subject !== subject || used.uses >= PROOF_MAX_USES)) {
    throw new ApiError(401, "otp_invalid");
  }
  return {
    commit: () =>
      tx.set(ref, {
        purpose: proof.purpose,
        subject,
        uses: (used?.uses ?? 0) + 1,
        expireAt: Timestamp.fromMillis(proof.exp + 60_000),
      }),
  };
}
