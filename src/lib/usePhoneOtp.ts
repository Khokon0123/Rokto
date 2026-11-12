"use client";

import { useCallback, useRef, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { apiCall } from "@/lib/api";
import { onlyDigits } from "@/lib/digits";
import { solveCaptcha } from "@/lib/turnstile";

export type OtpStatus = "idle" | "sending" | "sent" | "verifying";
export type OtpPurpose = "register" | "recover" | "change_phone" | "signin";

export interface VerifiedPhone {
  proof: string;
  /** Present for the purposes that open an account; the cookie is already set when it is. */
  username?: string;
  created?: boolean;
}

/**
 * One-time phone verification by SMS (our own /api/otp routes). This is NOT a login: a correct
 * code returns a short-lived signed proof that ONE endpoint (named by `purpose`) accepts.
 * The server's challengeId ties the code to the send that created it (D4).
 */
export function usePhoneOtp(purpose: OtpPurpose) {
  const { locale } = useLocale();
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const sent = useRef<{ phone: string; challengeId: string } | null>(null);
  const holder = useRef<HTMLDivElement | null>(null); // where the (usually invisible) CAPTCHA renders

  const sendCode = useCallback(
    async (e164: string): Promise<boolean> => {
      setErrorCode(null);
      setStatus("sending");
      let captcha: string | null = null;
      try {
        captcha = await solveCaptcha(holder.current, "otp_send");
      } catch (e) {
        setErrorCode(e instanceof Error ? e.message : "captcha_failed");
        setStatus(sent.current?.phone === e164 ? "sent" : "idle");
        return false;
      }
      const res = await apiCall<{ challengeId: string }>("/api/otp/send", "POST", { phone: e164, captcha, purpose, locale });
      if (!res.ok || !res.data) {
        setErrorCode(res.error ?? "generic");
        setStatus(sent.current?.phone === e164 ? "sent" : "idle"); // keep the code box if one was already sent
        return false;
      }
      sent.current = { phone: e164, challengeId: res.data.challengeId };
      setStatus("sent");
      return true;
    },
    [purpose, locale],
  );

  /**
   * Returns the signed proof of phone ownership, or null if the code was wrong. For the purposes
   * that also open an account ("register", "signin") the answer carries the username as well: one
   * code does both, so there is no second round trip to find out who you are.
   */
  const verifyCode = useCallback(
    async (code: string): Promise<VerifiedPhone | null> => {
      if (!sent.current) return null;
      setErrorCode(null);
      setStatus("verifying");
      const res = await apiCall<VerifiedPhone>("/api/otp/verify", "POST", {
        phone: sent.current.phone,
        code: onlyDigits(code),
        challengeId: sent.current.challengeId,
        purpose,
      });
      setStatus("sent");
      if (res.ok && res.data) return res.data;
      setErrorCode(res.error ?? "generic");
      return null;
    },
    [purpose],
  );

  return { holder, status, errorCode, sendCode, verifyCode };
}
