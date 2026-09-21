"use client";

import { useCallback, useRef, useState } from "react";
import { apiCall } from "@/lib/api";
import { solveCaptcha } from "@/lib/turnstile";

export type OtpStatus = "idle" | "sending" | "sent" | "verifying";

/**
 * One-time phone verification by SMS (our own /api/otp routes, texted through BulkSMSBD).
 * This is NOT a login: a correct code returns a short-lived signed proof that the register /
 * recover / phone-change endpoints accept. Nothing is stored in the browser.
 */
export function usePhoneOtp() {
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const phoneRef = useRef<string | null>(null);
  const holder = useRef<HTMLDivElement | null>(null); // where the (usually invisible) CAPTCHA renders

  const sendCode = useCallback(async (e164: string): Promise<boolean> => {
    setErrorCode(null);
    setStatus("sending");
    let captcha: string | null = null;
    try {
      captcha = await solveCaptcha(holder.current);
    } catch {
      setErrorCode("captcha_failed");
      setStatus("idle");
      return false;
    }
    const res = await apiCall("/api/otp/send", "POST", { phone: e164, captcha });
    if (!res.ok) {
      setErrorCode(res.error ?? "generic");
      setStatus(phoneRef.current === e164 ? "sent" : "idle"); // keep the code box if one was already sent
      return false;
    }
    phoneRef.current = e164;
    setStatus("sent");
    return true;
  }, []);

  /** Returns the signed proof of phone ownership, or null if the code was wrong. */
  const verifyCode = useCallback(async (code: string): Promise<string | null> => {
    if (!phoneRef.current) return null;
    setErrorCode(null);
    setStatus("verifying");
    const res = await apiCall<{ proof: string }>("/api/otp/verify", "POST", {
      phone: phoneRef.current,
      code: code.trim(),
    });
    setStatus("sent");
    if (res.ok && res.data) return res.data.proof;
    setErrorCode(res.error ?? "generic");
    return null;
  }, []);

  return { holder, status, errorCode, sendCode, verifyCode };
}
