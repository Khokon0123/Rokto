"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import AvatarPicker from "@/components/AvatarPicker";
import type { VerifiedPhone } from "@/lib/usePhoneOtp";
import EditLinkCard from "@/components/EditLinkCard";
import LocationField from "@/components/LocationField";
import OtpVerification from "@/components/OtpVerification";
import Switch from "@/components/Switch";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import { btnGhostOnRed, btnOnRed, btnPrimary, btnSecondary, cardClass, errorOnRed, inputClass, labelOnRed } from "@/components/styles";
import { fmt } from "@/i18n";
import { apiCall } from "@/lib/api";
import { BLOOD_GROUPS, isBloodGroup } from "@/lib/bloodGroups";
import type { GeoPoint } from "@/lib/geo";
import { normalizeBdPhone } from "@/lib/phone";
import { cleanName, parseDonationCount, todayIso } from "@/lib/validation";

type Step = "form" | "otp" | "saving" | "saveFailed" | "done";
type Field = "name" | "phone" | "bloodGroup" | "area" | "lastDonated" | "donationCount" | "consent";
/** Which step each field lives on (step 1 only, when someone just wants a username). */
const STEP_OF: Record<Field, number> = { name: 1, phone: 1, bloodGroup: 2, area: 2, lastDonated: 3, donationCount: 3, consent: 3 };
const FIELD_ORDER: Field[] = ["name", "phone", "bloodGroup", "area", "lastDonated", "donationCount", "consent"];
const FIELD_IDS: Record<Field, string> = {
  name: "name",
  phone: "phone",
  bloodGroup: "bloodGroup",
  area: "register-area",
  lastDonated: "lastDonated",
  donationCount: "donationCount",
  consent: "consent",
};
type FieldErrors = Partial<
  Record<Field, string>
>;

/** Only our own paths: a `next` of "//evil.com" or "/\\evil.com" must never become a redirect. */
function safeNext(raw: string | null): string {
  return raw && /^\/(?![\/\\])/.test(raw) && !/[\u0000-\u001f]/.test(raw) ? raw : "/search";
}

/** The whole page is red (data-red-page, see globals.css); every state of the flow sits on it. */
export default function RegisterClient() {
  return (
    <div data-red-page className="relative -mt-2">
      <RegisterFlow />
    </div>
  );
}

function RegisterFlow() {
  const t = useT();
  const errorMessage = useErrorMessage();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [account, setAccount] = useState<{ username: string; created: boolean } | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [page, setPage] = useState(1); // which of the three form steps is showing
  const [moreOpen, setMoreOpen] = useState(false);
  const [name, setName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [available, setAvailable] = useState(true); // default ON
  const [lastDonated, setLastDonated] = useState("");
  const [neverDonated, setNeverDonated] = useState(false);
  const [donationCount, setDonationCount] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [result, setResult] = useState<{ editToken: string; existing: boolean } | null>(null);
  // F9: a verified phone stays verified for the proof's lifetime. A failed save is retried with the
  // same proof (the server accepts an identical retry) instead of texting, and paying for, a new code.
  const [proof, setProof] = useState<{ value: string; phone: string; expiresAt: number } | null>(null);

  const total = 3;
  // After a step change, focus lands on the first problem field, or else on the step's heading
  // (so a keyboard or screen-reader user starts the new step at its top).
  const pendingFocus = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownPage = useRef(page);
  useEffect(() => {
    if (shownPage.current === page) return; // not a step change (also skips React's dev double-run)
    shownPage.current = page;
    if (pendingFocus.current) document.getElementById(pendingFocus.current)?.focus();
    else headingRef.current?.focus();
    pendingFocus.current = null;
  }, [page]);

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
    lastDonated: neverDonated ? null : lastDonated || null,
    donationCount: neverDonated ? 0 : Number(donationCount),
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
      setPage(1);
    } else setStep("saveFailed");
  }

  function goTo(n: number, focusId: string | null) {
    if (n === page) {
      if (focusId) document.getElementById(focusId)?.focus();
      return;
    }
    pendingFocus.current = focusId;
    setPage(n);
  }

  /** Every rule, for every field. onSubmit only reports the ones on or before the current step. */
  function problems(): FieldErrors {
    const bad: FieldErrors = {};
    if (!normalizeBdPhone(phoneInput)) bad.phone = t.form.enterPhone;
    if (!cleanName(name)) bad.name = t.form.enterName;
    if (!isBloodGroup(bloodGroup)) bad.bloodGroup = t.form.chooseBloodGroup;
    if (!area) bad.area = t.form.chooseArea;
    if (!neverDonated && !lastDonated) bad.lastDonated = t.form.enterLastDonated;
    else if (!neverDonated && lastDonated > todayIso()) bad.lastDonated = t.form.dateFuture;
    // "Never donated" means zero times; otherwise a whole number is required.
    const count = neverDonated ? 0 : parseDonationCount(donationCount.trim());
    if (count === undefined || count === null) bad.donationCount = t.form.enterCount;
    if (!consent) bad.consent = t.form.acceptConsent;
    return bad;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    const all = problems();
    // Next only complains about the step you are on (and earlier ones); the last step checks everything.
    const shown = FIELD_ORDER.filter((f) => all[f] && STEP_OF[f] <= page);
    setErrors(Object.fromEntries(shown.map((f) => [f, all[f]])) as FieldErrors);
    if (shown.length > 0) {
      // A1: take the person straight to the first problem, on whichever step it lives.
      goTo(STEP_OF[shown[0]], FIELD_IDS[shown[0]]);
      return;
    }
    if (page < total) {
      goTo(page + 1, null);
      return;
    }
    const phone = normalizeBdPhone(phoneInput);
    if (!phone) return;
    if (proof && proof.phone === phone && proof.expiresAt > Date.now() + 15_000) {
      void save(proof.value); // still verified: no new SMS
      return;
    }
    setVerifiedPhone(phone);
    setStep("otp");
  }

  async function onVerified(v: VerifiedPhone) {
    // Checking the code already opened the account and set the cookie (see /api/otp/verify); what is
    // left is writing the profile. Whether it shows in searches is the "available" switch.
    if (v.username) setAccount({ username: v.username, created: !!v.created });
    // The server's proof lifetime is 10 minutes; keep a safety margin on this side.
    setProof({ value: v.proof, phone: verifiedPhone ?? "", expiresAt: Date.now() + 9 * 60_000 });
    await save(v.proof);
  }

  if (step === "done") {
    return (
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
    );
  }

  if (step === "otp" && verifiedPhone) {
    return <OtpVerification phone={verifiedPhone} purpose="register" onVerified={onVerified} onCancel={() => setStep("form")} />;
  }

  if (step === "saveFailed") {
    return (
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
    );
  }

  if (step === "saving") {
    return <p className={`${cardClass} text-base text-muted`}>{t.register.saving}</p>;
  }

  const stepTitle = page === 1 ? t.register.stepYou : page === 2 ? t.register.stepBlood : t.register.stepFinish;
  const fieldError = (f: Field) =>
    errors[f] && (
      <p id={`${FIELD_IDS[f]}-error`} role="alert" className={errorOnRed}>
        {errors[f]}
      </p>
    );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div>
        <p className="text-sm font-bold text-white/90">{fmt(t.register.step, { n: page, total })}</p>
        <div className="mt-2 flex gap-2" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= page ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold leading-tight text-white focus:outline-none focus-visible:outline-none">
        {stepTitle}
      </h2>
      {page === 1 && <p className="text-base leading-relaxed text-white/90">{t.register.intro}</p>}

      {apiError && (
        <p role="alert" className="rounded-2xl border border-accent bg-accent-soft p-4 font-medium text-accent-deep">
          {errorMessage(apiError)}
        </p>
      )}

      {page === 1 && (
        <>
          <div>
            <label htmlFor="name" className={labelOnRed}>
              {t.register.name} <span aria-hidden="true">*</span>
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
            {fieldError("name")}
          </div>

          <div>
            <label htmlFor="phone" className={labelOnRed}>
              {t.register.phone} <span aria-hidden="true">*</span>
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
            <p className="mt-2 text-sm text-white/85">{t.register.phoneHelp}</p>
            {fieldError("phone")}
          </div>
        </>
      )}

      {page === 2 && (
        <>
          <div role="group" aria-labelledby="bloodGroup-label" aria-describedby={errors.bloodGroup ? "bloodGroup-error" : undefined}>
            <p id="bloodGroup-label" className={labelOnRed}>
              {t.register.bloodGroup} <span aria-hidden="true">*</span>
            </p>
            {/* Chips, not a select: one thumb tap, same as the search page. */}
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_GROUPS.map((g, i) => (
                <button
                  key={g}
                  id={i === 0 ? "bloodGroup" : undefined}
                  type="button"
                  aria-pressed={bloodGroup === g}
                  onClick={() => setBloodGroup(bloodGroup === g ? "" : g)}
                  className={`inline-flex min-h-14 items-center justify-center rounded-2xl border-2 text-lg font-extrabold ${
                    bloodGroup === g ? "border-white bg-white text-accent" : "border-white/40 bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            {fieldError("bloodGroup")}
          </div>

          <AreaAutocomplete
            value={area}
            onChange={setArea}
            label={t.register.area}
            placeholder={t.register.areaPlaceholder}
            required
            error={errors.area}
            id="register-area"
            onDark
          />
        </>
      )}

      {page === 3 && (
        <>
          <AvatarPicker value={avatar} onChange={setAvatar} onDark />

          <div>
            <label htmlFor="lastDonated" className={labelOnRed}>
              {t.register.lastDonated} <span aria-hidden="true">*</span>
            </label>
            <input
              id="lastDonated"
              aria-invalid={errors.lastDonated ? true : undefined}
              aria-describedby={errors.lastDonated ? "lastDonated-error" : undefined}
              type="date"
              max={todayIso()}
              value={neverDonated ? "" : lastDonated}
              disabled={neverDonated}
              onChange={(e) => setLastDonated(e.target.value)}
              className={`${inputClass} disabled:opacity-50`}
            />
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-base font-semibold text-white">
              <input
                type="checkbox"
                checked={neverDonated}
                onChange={(e) => setNeverDonated(e.target.checked)}
                className="size-6 shrink-0 accent-white"
              />
              {t.register.neverDonated}
            </label>
            {fieldError("lastDonated")}
          </div>

          <div>
            <label htmlFor="donationCount" className={labelOnRed}>
              {t.register.donationCount} <span aria-hidden="true">*</span>
            </label>
            <input
              id="donationCount"
              type="number"
              inputMode="numeric"
              min={0}
              max={200}
              step={1}
              required
              aria-required="true"
              value={neverDonated ? "0" : donationCount}
              disabled={neverDonated}
              onChange={(e) => setDonationCount(e.target.value)}
              placeholder="0"
              aria-invalid={errors.donationCount ? true : undefined}
              aria-describedby={errors.donationCount ? "donationCount-error" : "donationCount-hint"}
              className={`${inputClass} disabled:opacity-50`}
            />
            <p id="donationCount-hint" className="mt-2 text-sm text-white/85">{t.register.donationCountHint}</p>
            {fieldError("donationCount")}
          </div>

          <Switch checked={available} onChange={setAvailable} label={t.register.available} hint={t.register.availableHint} />

          <details open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)} className="group">
            <summary className="min-h-11 cursor-pointer list-none text-base font-bold text-white underline underline-offset-2">
              {t.register.moreOptions}
            </summary>
            <div className="mt-4 space-y-5">
              <LocationField value={location} onChange={setLocation} copy={t.register.location} />
            </div>
          </details>

          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
              <input
                id="consent"
                type="checkbox"
                checked={consent}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? "consent-error" : undefined}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-7 w-7 shrink-0 accent-[#a8261f]"
              />
              <span className="text-base text-ink">{t.register.consent}</span>
            </label>
            <Link href="/privacy" target="_blank" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-white underline">
              {t.register.privacyLink} {"↗"}
            </Link>
            {fieldError("consent")}
          </div>
        </>
      )}

      <div className="flex gap-3">
        {page > 1 && (
          <button type="button" className={`${btnGhostOnRed} shrink-0`} onClick={() => goTo(page - 1, null)}>
            {t.register.back}
          </button>
        )}
        <button type="submit" className={`${btnOnRed} flex-1`}>
          {page < total ? t.register.next : t.register.submit}
        </button>
      </div>
    </form>
  );
}
