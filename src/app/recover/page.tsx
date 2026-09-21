"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import EditLinkCard from "@/components/EditLinkCard";
import OtpVerification from "@/components/OtpVerification";
import { btnPrimary, btnSecondary, errorTextClass, inputClass, labelClass } from "@/components/styles";
import { errorMessage, t } from "@/i18n";
import { apiCall } from "@/lib/api";
import { normalizeBdPhone } from "@/lib/phone";

type Step = "phone" | "otp" | "working" | "done";

export default function RecoverPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeBdPhone(phoneInput);
    if (!normalized) {
      setError("phone_invalid");
      return;
    }
    setError(null);
    setPhone(normalized);
    setStep("otp");
  }

  async function onVerified(proof: string) {
    setStep("working");
    const res = await apiCall<{ editToken: string }>("/api/recover", "POST", { proof });
    if (res.ok && res.data) {
      setToken(res.data.editToken);
      setStep("done");
    } else {
      setError(res.error ?? "generic");
      setStep("phone");
    }
  }

  if (step === "done" && token) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t.recover.successTitle}</h1>
        <EditLinkCard token={token} />
        <Link href="/" className={`${btnSecondary} w-full`}>
          {t.register.backHome}
        </Link>
      </div>
    );
  }

  if (step === "otp" && phone) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t.recover.title}</h1>
        <OtpVerification phone={phone} onVerified={onVerified} onCancel={() => setStep("phone")} />
      </div>
    );
  }

  if (step === "working") return <p className="pt-6 text-base text-muted">{t.edit.saving}</p>;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t.recover.title}</h1>
        <p className="mt-1 text-base text-muted">{t.recover.intro}</p>
      </div>
      <div>
        <label htmlFor="phone" className={labelClass}>
          {t.recover.phone}
        </label>
        <input
          id="phone"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          className={inputClass}
        />
        {error && <p className={errorTextClass}>{errorMessage(error)}</p>}
      </div>
      <button type="submit" className={`${btnPrimary} w-full`}>
        {t.recover.submit}
      </button>
    </form>
  );
}
