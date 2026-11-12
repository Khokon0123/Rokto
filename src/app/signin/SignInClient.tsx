"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import OtpVerification from "@/components/OtpVerification";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import { btnPrimary, cardClass, errorTextClass, inputClass, labelClass } from "@/components/styles";
import { apiCall } from "@/lib/api";
import { normalizeBdPhone } from "@/lib/phone";

type Step = "phone" | "otp" | "done";

/** Only our own paths: a `next` of "//evil.com" or "https://..." must never become a redirect. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/search";
}

export default function SignInClient() {
  const t = useT();
  const errorMessage = useErrorMessage();
  const next = safeNext(useSearchParams().get("next"));

  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ username: string; created: boolean } | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const e164 = normalizeBdPhone(phoneInput);
    if (!e164) return setError("phone_invalid");
    setError(null);
    setPhone(e164);
    setStep("otp");
  }

  async function onVerified(proof: string) {
    const res = await apiCall<{ username: string; created: boolean }>("/api/account/signin", "POST", { proof });
    if (!res.ok || !res.data) {
      setError(res.error ?? "generic");
      setStep("phone");
      return;
    }
    setResult(res.data);
    setStep("done");
  }

  if (step === "otp" && phone) {
    return (
      <div className="relative -mt-14">
        <OtpVerification phone={phone} purpose="signin" onVerified={onVerified} onCancel={() => setStep("phone")} />
      </div>
    );
  }

  if (step === "done" && result) {
    return (
      <div className="relative -mt-14">
        <div className={`${cardClass} space-y-5`}>
          <p className="text-lg font-bold text-ink">{result.created ? t.signin.welcome : t.signin.welcomeBack}</p>
          <div className="rounded-2xl border border-line bg-page p-4">
            <p className="text-sm font-semibold text-muted">{t.signin.yourUsername}</p>
            <p className="mt-1 break-all text-2xl font-extrabold tracking-tight text-accent">{result.username}</p>
          </div>
          <p className="text-base leading-relaxed text-muted">{t.signin.usernameNote}</p>
          <Link href={next} className={`${btnPrimary} w-full`}>
            {t.signin.continue}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative -mt-14">
      <form onSubmit={onSubmit} noValidate className={`${cardClass} space-y-6`}>
        <p className="text-base leading-relaxed text-muted">{t.signin.lede}</p>
        <div>
          <label htmlFor="signin-phone" className={labelClass}>
            {t.signin.phone}
          </label>
          <input
            id="signin-phone"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signin-error" : undefined}
            className={inputClass}
          />
          <p className="mt-1 text-sm text-muted">{t.signin.phoneHelp}</p>
          {error && (
            <p id="signin-error" role="alert" className={errorTextClass}>
              {errorMessage(error)}
            </p>
          )}
        </div>
        {/* Said before the code is sent, not after: people should know what they are joining. */}
        <p className="rounded-2xl border border-line bg-page p-4 text-sm leading-relaxed text-muted">{t.signin.consent}</p>
        <button type="submit" className={`${btnPrimary} w-full`}>
          {t.signin.send}
        </button>
      </form>
    </div>
  );
}
