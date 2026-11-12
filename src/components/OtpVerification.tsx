"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { OTP_RESEND_SECONDS } from "@/config/app";
import { useErrorMessage, useLocale, useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { formatNumber } from "@/i18n/locale";
import { formatLocalPhone } from "@/lib/phone";
import { onlyDigits } from "@/lib/digits";
import { usePhoneOtp, type OtpPurpose, type VerifiedPhone } from "@/lib/usePhoneOtp";
import { btnPrimary, cardClass, errorTextClass, inputClass, labelClass } from "./styles";

interface Props {
  phone: string; // E.164
  /** Which endpoint the resulting proof is for (S11). */
  purpose: OtpPurpose;
  /** Called once the code is accepted: the proof, plus the username when an account was opened. */
  onVerified: (verified: VerifiedPhone) => void;
  onCancel: () => void;
}

/** Sends a code to `phone` on mount, then collects and verifies it. Reused by every OTP step. */
export default function OtpVerification({ phone, purpose, onVerified, onCancel }: Props) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { locale } = useLocale();
  const { holder, status, errorCode, sendCode, verifyCode } = usePhoneOtp(purpose);
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
    const verified = await verifyCode(code);
    if (verified) onVerified(verified);
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
              onChange={(e) => setCode(onlyDigits(e.target.value).slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              aria-invalid={errorCode ? true : undefined}
              aria-describedby={errorCode ? "otp-error" : undefined}
              className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
            />
            {errorCode && (
              <p id="otp-error" role="alert" className={errorTextClass}>
                {errorMessage(errorCode)}
              </p>
            )}
          </div>
          <button type="submit" disabled={busy || code.length < 6} className={`${btnPrimary} w-full`}>
            {status === "verifying" ? t.otp.verifying : t.otp.verify}
          </button>
        </form>
      )}

      {status === "idle" && errorCode && (
        <p role="alert" className={errorTextClass}>
          {errorMessage(errorCode)}
        </p>
      )}

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
          {cooldown > 0 ? fmt(t.otp.resendIn, { seconds: formatNumber(cooldown, locale) }) : t.otp.resend}
        </button>
      </div>
    </div>
  );
}
