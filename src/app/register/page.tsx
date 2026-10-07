"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import EditLinkCard from "@/components/EditLinkCard";
import LocationField from "@/components/LocationField";
import OtpVerification from "@/components/OtpVerification";
import Switch from "@/components/Switch";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary, cardClass, errorTextClass, inputClass, labelClass } from "@/components/styles";
import { apiCall } from "@/lib/api";
import { BLOOD_GROUPS, isBloodGroup } from "@/lib/bloodGroups";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { GeoPoint } from "@/lib/geo";
import { normalizeBdPhone } from "@/lib/phone";
import { cleanName, todayIso } from "@/lib/validation";

type Step = "form" | "otp" | "saving" | "done";
type FieldErrors = Partial<
  Record<"name" | "phone" | "bloodGroup" | "area" | "lastDonated" | "consent", string>
>;

export default function RegisterPage() {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [available, setAvailable] = useState(true); // default ON
  const [lastDonated, setLastDonated] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [result, setResult] = useState<{ editToken: string; existing: boolean } | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    const next: FieldErrors = {};
    const phone = normalizeBdPhone(phoneInput);
    if (!cleanName(name)) next.name = t.form.enterName;
    if (!phone) next.phone = t.form.enterPhone;
    if (!isBloodGroup(bloodGroup)) next.bloodGroup = t.form.chooseBloodGroup;
    if (!area) next.area = t.form.chooseArea;
    if (lastDonated && lastDonated > todayIso()) next.lastDonated = t.form.dateFuture;
    if (!consent) next.consent = t.form.acceptConsent;
    setErrors(next);
    if (Object.keys(next).length > 0 || !phone) return;
    setVerifiedPhone(phone);
    setStep("otp");
  }

  async function onVerified(proof: string) {
    setStep("saving");
    const res = await apiCall<{ editToken: string; existing: boolean }>("/api/donors", "POST", {
      proof,
      name,
      bloodGroup,
      area,
      location,
      available,
      lastDonated: lastDonated || null,
      consent,
    });
    if (res.ok && res.data) {
      setResult(res.data);
      setStep("done");
    } else {
      setApiError(res.error ?? "generic");
      setStep("form");
    }
  }

  if (step === "done" && result) {
    return (
      <div className="relative -mt-14">
        <div className={`${cardClass} space-y-5`}>
          <h2 className="text-2xl font-bold">{t.register.successTitle}</h2>
          {result.existing && (
            <p className="rounded-2xl bg-page p-4 text-base text-ink">{t.register.successExisting}</p>
          )}
          <EditLinkCard token={result.editToken} />
          <Link href="/" className={`${btnSecondary} w-full`}>
            {t.register.backHome}
          </Link>
        </div>
      </div>
    );
  }

  if (step === "otp" && verifiedPhone) {
    return (
      <div className="relative -mt-14">
        <OtpVerification phone={verifiedPhone} onVerified={onVerified} onCancel={() => setStep("form")} />
      </div>
    );
  }

  if (step === "saving") {
    return (
      <div className="relative -mt-14">
        <p className={`${cardClass} text-base text-muted`}>{t.register.saving}</p>
      </div>
    );
  }

  return (
    <div className="relative -mt-14">
    <form onSubmit={onSubmit} noValidate className={`${cardClass} space-y-6`}>
      <p className="text-base text-muted">{t.register.intro}</p>

      {!isFirebaseConfigured() && (
        <p className="rounded-2xl bg-page p-4 text-base text-ink">{t.search.notConfigured}</p>
      )}
      {apiError && (
        <p role="alert" className="rounded-2xl border border-accent bg-accent-soft p-4 font-medium text-accent-deep">
          {errorMessage(apiError)}
        </p>
      )}

      <div>
        <label htmlFor="name" className={labelClass}>
          {t.register.name} <span className="text-accent">*</span>
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.register.namePlaceholder}
          autoComplete="name"
          maxLength={80}
          className={inputClass}
        />
        {errors.name && <p className={errorTextClass}>{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>
          {t.register.phone} <span className="text-accent">*</span>
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
        <p className="mt-1 text-sm text-muted">{t.register.phoneHelp}</p>
        {errors.phone && <p className={errorTextClass}>{errors.phone}</p>}
      </div>

      <div>
        <label htmlFor="bloodGroup" className={labelClass}>
          {t.register.bloodGroup} <span className="text-accent">*</span>
        </label>
        <select
          id="bloodGroup"
          value={bloodGroup}
          onChange={(e) => setBloodGroup(e.target.value)}
          className={inputClass}
        >
          <option value="">{t.register.bloodGroupPlaceholder}</option>
          {BLOOD_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {errors.bloodGroup && <p className={errorTextClass}>{errors.bloodGroup}</p>}
      </div>

      <AreaAutocomplete
        value={area}
        onChange={setArea}
        label={t.register.area}
        placeholder={t.register.areaPlaceholder}
        required
        error={errors.area}
      />

      <LocationField value={location} onChange={setLocation} copy={t.register.location} />

      <Switch
        checked={available}
        onChange={setAvailable}
        label={t.register.available}
        hint={t.register.availableHint}
      />

      <div>
        <label htmlFor="lastDonated" className={labelClass}>
          {t.register.lastDonated}
        </label>
        <input
          id="lastDonated"
          type="date"
          max={todayIso()}
          value={lastDonated}
          onChange={(e) => setLastDonated(e.target.value)}
          className={inputClass}
        />
        {errors.lastDonated && <p className={errorTextClass}>{errors.lastDonated}</p>}
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-7 w-7 shrink-0 accent-[#b91c1c]"
          />
          <span className="text-base text-ink">{t.register.consent}</span>
        </label>
        {errors.consent && <p className={errorTextClass}>{errors.consent}</p>}
      </div>

      <button type="submit" className={`${btnPrimary} w-full`}>
        {t.register.submit}
      </button>
    </form>
    </div>
  );
}
