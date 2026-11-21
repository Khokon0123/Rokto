"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import AvatarPicker from "@/components/AvatarPicker";
import type { VerifiedPhone } from "@/lib/usePhoneOtp";
import EditLinkCard from "@/components/EditLinkCard";
import LocationField from "@/components/LocationField";
import OtpVerification from "@/components/OtpVerification";
import Switch from "@/components/Switch";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary, cardClass, errorTextClass, inputClass, labelClass } from "@/components/styles";
import { apiCall } from "@/lib/api";
import { BLOOD_GROUPS, isBloodGroup } from "@/lib/bloodGroups";
import type { GeoPoint } from "@/lib/geo";
import { normalizeBdPhone } from "@/lib/phone";
import { cleanName, todayIso } from "@/lib/validation";

type Step = "form" | "otp" | "saving" | "saveFailed" | "done";
type Field = "name" | "phone" | "bloodGroup" | "area" | "lastDonated" | "consent";
const FIELD_IDS: Record<Field, string> = {
  name: "name",
  phone: "phone",
  bloodGroup: "bloodGroup",
  area: "register-area",
  lastDonated: "lastDonated",
  consent: "consent",
};
type FieldErrors = Partial<
  Record<"name" | "phone" | "bloodGroup" | "area" | "lastDonated" | "consent", string>
>;

/** Only our own paths: a `next` of "//evil.com" or "/\\evil.com" must never become a redirect. */
function safeNext(raw: string | null): string {
  return raw && /^\/(?![\/\\])/.test(raw) && !/[\u0000-\u001f]/.test(raw) ? raw : "/search";
}

export default function RegisterClient() {
  const t = useT();
  const errorMessage = useErrorMessage();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  // Arriving from "Register as a donor" ticks the box; arriving from a search does not.
  const [asDonor, setAsDonor] = useState(params.get("donor") === "1");
  const [account, setAccount] = useState<{ username: string; created: boolean } | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [available, setAvailable] = useState(true); // default ON
  const [lastDonated, setLastDonated] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [result, setResult] = useState<{ editToken: string; existing: boolean } | null>(null);
  // F9: a verified phone stays verified for the proof's lifetime. A failed save is retried with the
  // same proof (the server accepts an identical retry) instead of texting, and paying for, a new code.
  const [proof, setProof] = useState<{ value: string; phone: string; expiresAt: number } | null>(null);

  // The edit link is shown only once: warn before the page is closed or reloaded.
  useEffect(() => {
    if (step !== "done") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);

  const payload = () => ({
    name,
    bloodGroup,
    area,
    location,
    avatar,
    available,
    lastDonated: lastDonated || null,
    consent,
  });

  async function save(p: string) {
    setStep("saving");
    const res = await apiCall<{ editToken: string; existing: boolean }>("/api/donors", "POST", { proof: p, ...payload() });
    if (res.ok && res.data) {
      setResult(res.data);
      setProof(null);
      setStep("done");
      return;
    }
    setApiError(res.error ?? "generic");
    // A proof the server rejected (expired/invalid) is dropped, so the next submit re-verifies.
    if (res.error === "otp_invalid" || res.error === "otp_expired") {
      setProof(null);
      setStep("form");
    } else setStep("saveFailed");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    const bad: FieldErrors = {};
    const phone = normalizeBdPhone(phoneInput);
    if (!phone) bad.phone = t.form.enterPhone;
    if (asDonor) {
      if (!cleanName(name)) bad.name = t.form.enterName;
      if (!isBloodGroup(bloodGroup)) bad.bloodGroup = t.form.chooseBloodGroup;
      if (!area) bad.area = t.form.chooseArea;
      if (lastDonated && lastDonated > todayIso()) bad.lastDonated = t.form.dateFuture;
      if (!consent) bad.consent = t.form.acceptConsent;
    }
    setErrors(bad);
    const firstBad = (Object.keys(FIELD_IDS) as Field[]).find((f) => bad[f]);
    if (firstBad) {
      // A1: take the person straight to the first problem.
      document.getElementById(FIELD_IDS[firstBad])?.focus();
      return;
    }
    if (!phone) return;
    if (asDonor && proof && proof.phone === phone && proof.expiresAt > Date.now() + 15_000) {
      void save(proof.value); // still verified: no new SMS
      return;
    }
    setVerifiedPhone(phone);
    setStep("otp");
  }

  async function onVerified(v: VerifiedPhone) {
    // Checking the code already opened the account and set the cookie (see /api/otp/verify), so
    // from here the only question left is whether to also write a donor listing.
    if (v.username) setAccount({ username: v.username, created: !!v.created });
    if (!asDonor) {
      setStep("done");
      return;
    }
    // The server's proof lifetime is 10 minutes; keep a safety margin on this side.
    setProof({ value: v.proof, phone: verifiedPhone ?? "", expiresAt: Date.now() + 9 * 60_000 });
    await save(v.proof);
  }

  if (step === "done") {
    return (
      <div className="relative -mt-14">
        <div className={`${cardClass} space-y-5`}>
          <h2 className="text-2xl font-bold">{result ? t.register.successTitle : t.register.accountTitle}</h2>
          {account && (
            <div className="rounded-2xl border border-line bg-page p-4">
              <p className="text-sm font-semibold text-muted">{t.account.username}</p>
              <p className="mt-1 break-all text-2xl font-extrabold tracking-tight text-accent">{account.username}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t.signin.usernameNote}</p>
            </div>
          )}
          {result?.existing && <p className="rounded-2xl bg-page p-4 text-base text-ink">{t.register.successExisting}</p>}
          {result && <EditLinkCard token={result.editToken} />}
          <Link href={next} className={`${btnPrimary} w-full`}>
            {t.signin.continue}
          </Link>
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
        <OtpVerification phone={verifiedPhone} purpose={asDonor ? "register" : "signin"} onVerified={onVerified} onCancel={() => setStep("form")} />
      </div>
    );
  }

  if (step === "saveFailed") {
    return (
      <div className="relative -mt-14">
        <div className={`${cardClass} space-y-4`}>
          <p role="alert" className="text-base font-medium text-ink">
            {t.register.saveFailed}
          </p>
          {apiError && <p className="text-sm text-muted">{errorMessage(apiError)}</p>}
          <button type="button" className={`${btnPrimary} w-full`} onClick={() => proof && void save(proof.value)}>
            {t.register.retrySave}
          </button>
          <button type="button" className={`${btnSecondary} w-full`} onClick={() => setStep("form")}>
            {t.register.editForm}
          </button>
        </div>
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
      <p className="text-base leading-relaxed text-muted">{asDonor ? t.register.intro : t.register.accountIntro}</p>

      {apiError && (
        <p role="alert" className="rounded-2xl border border-accent bg-accent-soft p-4 font-medium text-accent-deep">
          {errorMessage(apiError)}
        </p>
      )}

      {asDonor && (
      <div>
        <label htmlFor="name" className={labelClass}>
          {t.register.name} <span className="text-accent">*</span>
        </label>
        <input
          id="name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : undefined}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.register.namePlaceholder}
          autoComplete="name"
          maxLength={80}
          required
          aria-required="true"
          className={inputClass}
        />
        {errors.name && (
          <p id="name-error" className={errorTextClass}>
            {errors.name}
          </p>
        )}
      </div>
      )}

      <div>
        <label htmlFor="phone" className={labelClass}>
          {t.register.phone} <span className="text-accent">*</span>
        </label>
        <input
          id="phone"
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? "phone-error" : undefined}
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          className={inputClass}
        />
        <p className="mt-1 text-sm text-muted">{t.register.phoneHelp}</p>
        {errors.phone && (
          <p id="phone-error" className={errorTextClass}>
            {errors.phone}
          </p>
        )}
      </div>

      {/* The whole point of this page being one page: an account for everyone, a listing only
          for the people who actually want to give blood. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
        <input
          id="asDonor"
          type="checkbox"
          checked={asDonor}
          onChange={(e) => setAsDonor(e.target.checked)}
          className="mt-1 size-7 shrink-0 accent-accent"
        />
        <span>
          <span className="block text-base font-semibold text-ink">{t.register.asDonor}</span>
          <span className="mt-1 block text-sm leading-relaxed text-muted">{t.register.asDonorHint}</span>
        </span>
      </label>

      {asDonor && (
        <>
      <div>
        <label htmlFor="bloodGroup" className={labelClass}>
          {t.register.bloodGroup} <span className="text-accent">*</span>
        </label>
        <select
          id="bloodGroup"
          aria-invalid={errors.bloodGroup ? true : undefined}
          aria-describedby={errors.bloodGroup ? "bloodGroup-error" : undefined}
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
        {errors.bloodGroup && (
          <p id="bloodGroup-error" className={errorTextClass}>
            {errors.bloodGroup}
          </p>
        )}
      </div>

      <AreaAutocomplete
        value={area}
        onChange={setArea}
        label={t.register.area}
        placeholder={t.register.areaPlaceholder}
        required
        error={errors.area}
        id="register-area"
      />

      <AvatarPicker value={avatar} onChange={setAvatar} />

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
          aria-invalid={errors.lastDonated ? true : undefined}
          aria-describedby={errors.lastDonated ? "lastDonated-error" : undefined}
          type="date"
          max={todayIso()}
          value={lastDonated}
          onChange={(e) => setLastDonated(e.target.value)}
          className={inputClass}
        />
        {errors.lastDonated && (
          <p id="lastDonated-error" className={errorTextClass}>
            {errors.lastDonated}
          </p>
        )}
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? "consent-error" : undefined}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-7 w-7 shrink-0 accent-[#b91c1c]"
          />
          <span className="text-base text-ink">{t.register.consent}</span>
        </label>
        <Link href="/privacy" target="_blank" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline">
          {t.register.privacyLink} {"↗"}
        </Link>
        {errors.consent && (
          <p id="consent-error" className={errorTextClass}>
            {errors.consent}
          </p>
        )}
      </div>
        </>
      )}

      <button type="submit" className={`${btnPrimary} w-full`}>
        {t.register.submit}
      </button>
    </form>
    </div>
  );
}
