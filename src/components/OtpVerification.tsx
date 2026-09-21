"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { OTP_RESEND_SECONDS } from "@/config/app";
import { errorMessage, fmt, t } from "@/i18n";
import { formatLocalPhone } from "@/lib/phone";
import { usePhoneOtp } from "@/lib/usePhoneOtp";
import { btnPrimary, cardClass, errorTextClass, inputClass, labelClass } from "./styles";

interface Props {
  phone: string; // E.164
  /** Called once with a signed proof that this phone number was just verified. */
  onVerified: (proof: string) => void;
  onCancel: () => void;
}

/** Sends a code to `phone` on mount, then collects and verifies it. Reused by every OTP step. */
export default function OtpVerification({ phone, onVerified, onCancel }: Props) {
  const { holder, status, errorCode, sendCode, verifyCode } = usePhoneOtp();
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(OTP_RESEND_SECONDS);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // guard against StrictMode's double effect (would send, and pay for, two SMS)
    started.current = true;
    void sendCode(phone);
  }, [phone, sendCode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length < 6) return;
    const proof = await verifyCode(code);
    if (proof) onVerified(proof);
  }

  async function resend() {
    setCode("");
    setCooldown(OTP_RESEND_SECONDS);
    await sendCode(phone);
  }

  const busy = status === "sending" || status === "verifying";

  return (
    <div className={cardClass}>
      <div ref={holder} />
      {status === "sending" && <p className="text-base text-muted">{t.otp.sending}</p>}

      {status !== "sending" && status !== "idle" && (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-base text-ink">{fmt(t.otp.sentTo, { phone: formatLocalPhone(phone) })}</p>
          <div>
            <label htmlFor="otp-code" className={labelClass}>
              {t.otp.code}
            </label>
            <input
              id="otp-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
            />
            {errorCode && <p className={errorTextClass}>{errorMessage(errorCode)}</p>}
          </div>
          <button type="submit" disabled={busy || code.length < 6} className={`${btnPrimary} w-full`}>
            {status === "verifying" ? t.otp.verifying : t.otp.verify}
          </button>
        </form>
      )}

      {status === "idle" && errorCode && <p className={errorTextClass}>{errorMessage(errorCode)}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" onClick={onCancel} className="min-h-11 font-semibold text-accent underline">
          {t.otp.change}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || busy}
          className="min-h-11 font-semibold text-accent underline disabled:text-muted disabled:no-underline"
        >
          {cooldown > 0 ? fmt(t.otp.resendIn, { seconds: cooldown }) : t.otp.resend}
        </button>
      </div>
    </div>
  );
}
