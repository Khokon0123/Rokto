import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAdminPassword, isValidAdminSession, signAdminSession } from "@/lib/server/adminAuth";
import { checkSiteVerify } from "@/lib/server/captcha";
import { configIssues, assertProductionConfig } from "@/lib/server/env";
import { signProof, verifyPhoneProof } from "@/lib/server/otp";
import { clientIp, subnetOf } from "@/lib/server/rateLimit";
import { checkRevealPass, issueRevealPass } from "@/lib/server/revealPass";
import { budgetFor, dailyCap } from "@/lib/server/otp";
import { readAccountSession, signAccountSession } from "@/lib/server/accountAuth";
import { generateUsername, isUsername } from "@/lib/server/username";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("S7: admin sessions", () => {
  it("a session issued before a password change is rejected after it", () => {
    vi.stubEnv("ADMIN_PASSWORD", "first-password-long-enough");
    const token = signAdminSession();
    expect(isValidAdminSession(token)).toBe(true);
    vi.stubEnv("ADMIN_PASSWORD", "second-password-long-enough");
    expect(isValidAdminSession(token)).toBe(false);
  });
  it("bumping ADMIN_SESSION_VERSION revokes every session", () => {
    vi.stubEnv("ADMIN_PASSWORD", "first-password-long-enough");
    const token = signAdminSession();
    vi.stubEnv("ADMIN_SESSION_VERSION", "2");
    expect(isValidAdminSession(token)).toBe(false);
  });
  it("sessions expire after 12 hours and can't be forged", () => {
    vi.stubEnv("ADMIN_PASSWORD", "first-password-long-enough");
    const old = signAdminSession({ email: null }, Date.now() - 13 * 3600_000);
    expect(isValidAdminSession(old)).toBe(false);
    const [payload] = signAdminSession().split(".");
    expect(isValidAdminSession(`${payload}.AAAA`)).toBe(false);
  });
  it("password check refuses short/missing passwords", () => {
    vi.stubEnv("ADMIN_PASSWORD", "first-password-long-enough");
    expect(checkAdminPassword("first-password-long-enough")).toBe(true);
    expect(checkAdminPassword("wrong")).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "short");
    expect(checkAdminPassword("short")).toBe(false);
  });
});

describe("S11: purpose-bound proofs", () => {
  const proof = (purpose: "register" | "recover" | "change_phone", exp = Date.now() + 60_000) =>
    signProof({ phone: "+8801712345678", purpose, jti: "abc", exp });
  it("is accepted only for its own purpose", () => {
    expect(verifyPhoneProof(proof("register"), "register").phone).toBe("+8801712345678");
    expect(() => verifyPhoneProof(proof("register"), "recover")).toThrow("otp_invalid");
    expect(() => verifyPhoneProof(proof("recover"), "change_phone")).toThrow("otp_invalid");
  });
  it("expires and can't be tampered with", () => {
    expect(() => verifyPhoneProof(proof("register", Date.now() - 1), "register")).toThrow("otp_expired");
    const [p, sig] = proof("register").split(".");
    const forged = Buffer.from(JSON.stringify({ phone: "+8801812345678", purpose: "register", jti: "abc", exp: Date.now() + 60_000 })).toString("base64url");
    expect(() => verifyPhoneProof(`${forged}.${sig}`, "register")).toThrow("otp_invalid");
    expect(() => verifyPhoneProof(`${p}`, "register")).toThrow("otp_invalid");
  });
});

describe("S12: Turnstile answer checks", () => {
  const hosts = ["www.roktoctg.com"];
  it("rejects wrong hostname, wrong action, failure", () => {
    expect(() => checkSiteVerify({ success: true, hostname: "evil.example", action: "otp_send" }, "otp_send", hosts)).toThrow();
    expect(() => checkSiteVerify({ success: true, hostname: "www.roktoctg.com", action: "reveal" }, "otp_send", hosts)).toThrow();
    expect(() => checkSiteVerify({ success: false, hostname: "www.roktoctg.com", action: "otp_send" }, "otp_send", hosts)).toThrow();
    expect(() => checkSiteVerify({ success: true, hostname: "www.roktoctg.com", action: "otp_send" }, "otp_send", hosts)).not.toThrow();
  });
  it("network failure is 'unavailable', not 'robot'; production without keys refuses", async () => {
    const { verifyCaptcha } = await import("@/lib/server/captcha");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "x".repeat(20));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(verifyCaptcha("t".repeat(20), "1.2.3.4", "otp_send")).rejects.toMatchObject({ status: 503, code: "captcha_unavailable" });
    vi.unstubAllGlobals();
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(verifyCaptcha(null, "1.2.3.4", "otp_send")).rejects.toMatchObject({ status: 503 });
  });
});

describe("S8: client IP", () => {
  const req = (h: Record<string, string>) => new Request("https://x.test/", { headers: h });
  it("a forged X-Forwarded-For never changes the key in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    expect(clientIp(req({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    vi.stubEnv("VERCEL", "");
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1" }))).toBe("unknown");
    vi.stubEnv("TRUSTED_IP_HEADER", "cf-connecting-ip");
    expect(clientIp(req({ "cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }))).toBe("8.8.8.8");
  });
  it("subnets", () => {
    expect(subnetOf("103.4.5.6")).toBe("103.4.5.0/24");
    expect(subnetOf("2001:db8:1:2::1")).toBe("2001:db8:1::/48");
  });
});

describe("D6/S3: SMS budget", () => {
  it("OTP_DAILY_CAP=0 really means zero; recover and sign-in have their own shares", () => {
    vi.stubEnv("OTP_DAILY_CAP", "0");
    expect(dailyCap()).toBe(0);
    vi.stubEnv("OTP_DAILY_CAP", "");
    expect(dailyCap()).toBe(300);
    vi.stubEnv("OTP_DAILY_CAP", "abc");
    expect(dailyCap()).toBe(300);
    expect(budgetFor("recover", 100).limit).toBe(30);
    expect(budgetFor("signin", 100).limit).toBe(25);
    // Registration keeps the remainder: a donor who cannot register is the worst failure, so it is
    // the one budget that is never carved into a fixed slice.
    expect(budgetFor("register", 100).limit).toBe(45);
    const keys = ["register", "recover", "signin"].map((p) => budgetFor(p as "register", 100).key);
    expect(new Set(keys).size).toBe(3);
  });
});

describe("reveal pass", () => {
  it("is bound to the IP and expires", () => {
    const pass = issueRevealPass("1.2.3.4");
    expect(checkRevealPass(pass, "1.2.3.4")).toBe(true);
    expect(checkRevealPass(pass, "5.6.7.8")).toBe(false);
    expect(checkRevealPass(issueRevealPass("1.2.3.4", Date.now() - 3600_000), "1.2.3.4")).toBe(false);
    expect(checkRevealPass("junk", "1.2.3.4")).toBe(false);
  });
});

describe("H2: production configuration", () => {
  it("lists every missing piece and refuses to start", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const k of ["OTP_SECRET", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "NEXT_PUBLIC_SITE_URL", "FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY", "FIRESTORE_EMULATOR_HOST", "SMS_PROVIDER"]) {
      vi.stubEnv(k, "");
    }
    const problems = configIssues().map((i) => i.subsystem);
    expect(new Set(problems)).toEqual(new Set(["firebase", "otp", "admin", "account", "captcha", "site", "sms"]));
    expect(() => assertProductionConfig()).toThrow(/incomplete/);
  });
  it("a complete config passes", () => {
    vi.stubEnv("NODE_ENV", "production");
    const env: Record<string, string> = {
      FIREBASE_ADMIN_PROJECT_ID: "p",
      FIREBASE_ADMIN_CLIENT_EMAIL: "e",
      FIREBASE_ADMIN_PRIVATE_KEY: "k",
      OTP_SECRET: "o".repeat(40),
      ADMIN_PASSWORD: "a".repeat(20),
      ADMIN_SESSION_SECRET: "s".repeat(40),
      SEEKER_SESSION_SECRET: "k".repeat(40),
      TURNSTILE_SECRET_KEY: "t",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "t",
      NEXT_PUBLIC_SITE_URL: "https://www.roktoctg.com",
      SMS_PROVIDER: "bulksmsdhaka",
      BULKSMSDHAKA_API_KEY: "k",
    };
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    expect(configIssues()).toEqual([]);
  });
});

describe("account sessions", () => {
  it("round-trips, and rejects tampering, expiry and a version bump", () => {
    vi.stubEnv("SEEKER_SESSION_SECRET", "account-secret-long-enough-for-the-check");
    const token = signAccountSession({ accountId: "abc123", username: "shanto-alo-472" });
    expect(readAccountSession(token)).toEqual({ accountId: "abc123", username: "shanto-alo-472" });

    expect(readAccountSession(undefined)).toBeNull();
    expect(readAccountSession("junk")).toBeNull();
    expect(readAccountSession(`${token}x`)).toBeNull();
    expect(readAccountSession(signAccountSession({ accountId: "a", username: "b" }, Date.now() - 86_400_000 * 40))).toBeNull();

    // Bumping the version signs everyone out at once.
    vi.stubEnv("SEEKER_SESSION_VERSION", "2");
    expect(readAccountSession(token)).toBeNull();
  });

  it("a account token is not an admin token, and the other way round", () => {
    vi.stubEnv("SEEKER_SESSION_SECRET", "account-secret-long-enough-for-the-check");
    vi.stubEnv("ADMIN_PASSWORD", "admin-password-long-enough");
    expect(readAccountSession(signAdminSession())).toBeNull();
    expect(isValidAdminSession(signAccountSession({ accountId: "a", username: "b" }))).toBe(false);
  });
});

describe("usernames", () => {
  it("generates the documented shape, and the shape check agrees", () => {
    for (let i = 0; i < 200; i++) expect(isUsername(generateUsername())).toBe(true);
    for (const bad of ["", "one-two", "ONE-TWO-123", "one-two-12", "one-two-012", "one two 123", 7, null]) {
      expect(isUsername(bad)).toBe(false);
    }
  });

  it("does not hand out the same name twice in a row very often", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateUsername()));
    expect(seen.size).toBeGreaterThan(480);
  });
});
