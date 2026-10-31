import { afterEach, describe, expect, it, vi } from "vitest";

// The SMS gateway is replaced: tests never send anything, and can make a send slow or fail.
const sent: string[] = [];
let nextSend: (() => Promise<void>) | null = null;
vi.mock("@/lib/server/sms", () => ({
  sendOtpSms: vi.fn(async (phone: string, code: string) => {
    const hook = nextSend;
    nextSend = null;
    if (hook) await hook();
    sent.push(`${phone}:${code}`);
  }),
}));

const { adminDb } = await import("@/lib/firebase/admin");
const { finishOtp, startOtp } = await import("@/lib/server/otp");
const { hit } = await import("@/lib/server/rateLimit");
const { sha256 } = await import("@/lib/server/keys");
const { dhakaDate } = await import("@/lib/dates");

afterEach(() => {
  sent.length = 0;
  nextSend = null;
  vi.restoreAllMocks();
});

const send = (phone: string, ip = "10.0.0.1", purpose = "register") => startOtp({ phone, captcha: null, ip, purpose });
const lastCode = () => sent.at(-1)!.split(":")[1];

describe("D4: challenges", () => {
  it("two parallel sends to one number: one SMS, one challenge", async () => {
    const out = await Promise.allSettled([send("01712345678"), send("01712345678")]);
    expect(out.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it("a failed send only removes its OWN challenge, never a newer one", async () => {
    let release!: () => void;
    nextSend = () =>
      new Promise<void>((_, reject) => {
        release = () => reject(Object.assign(new Error("sms_failed"), { status: 502, code: "sms_failed" }));
      });
    const a = send("01712345678");
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    const realNow = Date.now;
    vi.spyOn(Date, "now").mockImplementation(() => realNow() + 31_000); // past the resend cooldown
    const b = await send("01712345678");
    release();
    await expect(a).rejects.toBeTruthy();
    const { proof } = await finishOtp({ phone: "01712345678", code: lastCode(), challengeId: b.challengeId, purpose: "register" });
    expect(proof).toContain(".");
  });

  it("the code is bound to its challengeId and purpose", async () => {
    const { challengeId } = await send("01712345678");
    await expect(finishOtp({ phone: "01712345678", code: lastCode(), challengeId: "other", purpose: "register" })).rejects.toMatchObject({ code: "otp_expired" });
    await expect(finishOtp({ phone: "01712345678", code: lastCode(), challengeId, purpose: "recover" })).rejects.toMatchObject({ code: "otp_expired" });
    // Bengali digits are accepted (E1)
    const bn = lastCode().replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
    await expect(finishOtp({ phone: "01712345678", code: bn, challengeId, purpose: "register" })).resolves.toHaveProperty("proof");
  });
});

describe("S3: abuse ordering", () => {
  it("a request stopped by the IP limit does not spend the victim phone's budget", async () => {
    for (let i = 0; i < 10; i++) await send(`0171000000${i}`, "10.9.9.9");
    await expect(send("01799999999", "10.9.9.9")).rejects.toMatchObject({ code: "rate_limited" });
    const victimKey = sha256("otp:phone:+8801799999999");
    expect((await adminDb().collection("rateLimits").doc(victimKey).get()).exists).toBe(false);
    expect((await adminDb().collection("otpChallenges").get()).size).toBe(10);
  });

  it("OTP_DAILY_CAP=0 stops all SMS", async () => {
    vi.stubEnv("OTP_DAILY_CAP", "0");
    await expect(send("01712345678")).rejects.toMatchObject({ code: "sms_unavailable" });
    expect(sent).toHaveLength(0);
    vi.unstubAllEnvs();
  });

  it("a blocked phone gets no SMS", async () => {
    await adminDb().collection("blockedPhones").doc(sha256("+8801712345678")).set({ reason: "test" });
    await expect(send("01712345678")).rejects.toMatchObject({ code: "phone_blocked" });
  });
});

describe("S13: wrong guesses are capped per day, across resends", () => {
  it("after 15 failures the number is locked for the day", async () => {
    const { challengeId } = await send("01712345678");
    for (let i = 0; i < 15; i++) await hit(`otp:fail:+8801712345678:${dhakaDate()}`, 1000, 86_400);
    await expect(finishOtp({ phone: "01712345678", code: lastCode(), challengeId, purpose: "register" })).rejects.toMatchObject({ code: "otp_locked" });
  });
});
