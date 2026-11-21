"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import AvatarPicker from "@/components/AvatarPicker";
import type { VerifiedPhone } from "@/lib/usePhoneOtp";
import BloodBadge from "@/components/BloodBadge";
import LocationField from "@/components/LocationField";
import OtpVerification from "@/components/OtpVerification";
import Switch from "@/components/Switch";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary, cardClass, inputClass, labelClass } from "@/components/styles";
import { ALLOW_PROFILE_CORRECTIONS } from "@/config/app";
import { fmt } from "@/i18n";
import { apiCall } from "@/lib/api";
import { BLOOD_GROUPS, isBloodGroup, type BloodGroup } from "@/lib/bloodGroups";
import { formatLocalPhone, normalizeBdPhone } from "@/lib/phone";
import type { EditableProfile } from "@/lib/types";
import { cleanName, todayIso } from "@/lib/validation";

type Load = "loading" | "invalid" | "failed" | "ready" | "deleted";
type Save = "idle" | "saving" | "saved";
type Patch = Partial<Pick<EditableProfile, "available" | "lastDonated" | "area" | "location" | "name" | "bloodGroup" | "avatar">>;

type Result<T> = Awaited<ReturnType<typeof apiCall<T>>>;

/**
 * The two doors into a profile: a private edit link, and a signed-in account. Same editor, same
 * screen, same server-side validation - only the credential differs, so neither door can quietly
 * fall behind the other.
 */
export interface ProfileTransport {
  load: () => Promise<Result<{ profile: EditableProfile }>>;
  patch: (body: Record<string, unknown>) => Promise<Result<{ profile: EditableProfile }>>;
  remove: () => Promise<Result<unknown>>;
  /** Changing the number moves the account too, so it belongs to the link door for now. */
  allowPhoneChange: boolean;
}

export const tokenTransport = (token: string): ProfileTransport => ({
  load: () => apiCall<{ profile: EditableProfile }>("/api/edit", "POST", { token }),
  patch: (body) => apiCall<{ profile: EditableProfile }>("/api/edit", "PATCH", { token, ...body }),
  remove: () => apiCall("/api/edit", "DELETE", { token }),
  allowPhoneChange: true,
});

export const accountTransport = (): ProfileTransport => ({
  load: () => apiCall<{ profile: EditableProfile }>("/api/account/listing", "GET"),
  patch: (body) => apiCall<{ profile: EditableProfile }>("/api/account/listing", "PATCH", body),
  remove: () => apiCall("/api/account/listing", "DELETE", {}),
  allowPhoneChange: false,
});

/** F7: saves run one at a time, and only the newest response is allowed to update the screen. */
function useSaveQueue(transport: ProfileTransport) {
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const seq = useRef(0);
  return useCallback(
    (body: Record<string, unknown>) => {
      const mine = ++seq.current;
      const run = chain.current.then(() => transport.patch(body));
      chain.current = run.catch(() => undefined);
      return run.then((res) => ({ res, latest: mine === seq.current }));
    },
    [transport],
  );
}

export default function EditClient({ transport }: { transport: ProfileTransport }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [load, setLoad] = useState<Load>("loading");
  const [attempt, setAttempt] = useState(0);
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [save, setSave] = useState<Save>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [groupDraft, setGroupDraft] = useState<BloodGroup | null>(null);

  const [phoneMode, setPhoneMode] = useState<"closed" | "input" | "otp">("closed");
  const [phoneInput, setPhoneInput] = useState("");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [phoneNotice, setPhoneNotice] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const enqueue = useSaveQueue(transport);

  const applyProfile = useCallback((p: EditableProfile) => {
    setProfile(p);
    setDateDraft(p.lastDonated ?? "");
    setNameDraft(p.name);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void transport.load().then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) {
        applyProfile(res.data.profile);
        setLoad("ready");
      } else {
        // F6: ONLY a definite "this link is not valid" sends people to /recover (which would
        // replace their link). Network errors, timeouts and server errors get a Retry instead.
        setLoad(res.status === 404 && res.error === "link_invalid" ? "invalid" : "failed");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [transport, attempt, applyProfile]);

  /** Optimistic: the screen updates at once; on failure only the fields in this patch roll back. */
  const saveChange = useCallback(
    async (patch: Patch) => {
      setProfile((p) => (p ? { ...p, ...patch } : p));
      setError(null);
      setSave("saving");
      const { res, latest } = await enqueue(patch);
      if (res.ok && res.data) {
        if (latest) {
          applyProfile(res.data.profile);
          setSave("saved");
        }
        return;
      }
      setError(res.error ?? "generic");
      setSave("idle");
      // Re-read the truth from the server instead of guessing an older value (F7).
      const fresh = await transport.load();
      if (fresh.ok && fresh.data) applyProfile(fresh.data.profile);
    },
    [enqueue, applyProfile, transport],
  );

  function saveDate(e: FormEvent) {
    e.preventDefault();
    commitDate();
  }

  function commitDate() {
    // F8: only a complete, valid date different from the saved one is sent.
    const value = dateDraft || null;
    if (value === (profile?.lastDonated ?? null)) return;
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > todayIso())) {
      setError("date_invalid");
      return;
    }
    void saveChange({ lastDonated: value });
  }

  function saveName(e: FormEvent) {
    e.preventDefault();
    const name = cleanName(nameDraft);
    if (!name) return setError("name_invalid");
    if (name !== profile?.name) void saveChange({ name });
  }

  function startPhoneChange(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeBdPhone(phoneInput);
    if (!normalized) return setError("phone_invalid");
    if (normalized === profile?.phone) return setPhoneMode("closed");
    setError(null);
    setPendingPhone(normalized);
    setPhoneMode("otp");
  }

  async function onPhoneVerified({ proof }: VerifiedPhone) {
    setSave("saving");
    const { res } = await enqueue({ phone: pendingPhone, proof });
    if (res.ok && res.data) {
      applyProfile(res.data.profile);
      setPhoneMode("closed");
      setPhoneInput("");
      setPhoneNotice(true);
      setSave("saved");
    } else {
      setError(res.error ?? "generic");
      setPhoneMode("input");
      setSave("idle");
    }
  }

  async function deleteProfile() {
    setDeleting(true);
    const res = await transport.remove();
    if (res.ok) setLoad("deleted");
    else {
      setDeleting(false);
      setError(res.error ?? "generic");
    }
  }

  if (load === "loading") return <p className="pt-6 text-base text-muted">{t.edit.loading}</p>;

  if (load === "failed") {
    return (
      <div className="space-y-4 pt-2">
        <p role="alert" className={cardClass}>
          {t.edit.loadFailed}
        </p>
        <button
          type="button"
          className={`${btnPrimary} w-full`}
          onClick={() => {
            setLoad("loading");
            setAttempt((n) => n + 1);
          }}
        >
          {t.edit.retry}
        </button>
      </div>
    );
  }

  if (load === "invalid") {
    return (
      <div className="space-y-4 pt-2">
        <p role="alert" className={cardClass}>
          {t.edit.invalid}
        </p>
        <Link href="/recover" className={`${btnPrimary} w-full`}>
          {t.edit.invalidHelp}
        </Link>
      </div>
    );
  }

  if (load === "deleted") {
    return (
      <div className="space-y-4 pt-2">
        <p className={cardClass}>{t.edit.deleted}</p>
        <Link href="/" className={`${btnSecondary} w-full`}>
          {t.register.backHome}
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <BloodBadge group={profile.bloodGroup} />
        <div>
          <h1 className="text-2xl font-bold">{t.edit.title}</h1>
          <p className="text-base text-muted">{profile.name}</p>
        </div>
      </div>

      <p aria-live="polite" className="min-h-6 text-sm font-semibold text-muted">
        {save === "saving" ? t.edit.saving : save === "saved" ? t.edit.saved : ""}
      </p>
      {error && (
        <p role="alert" className="rounded-lg border border-accent bg-accent-soft p-3 font-medium text-accent-deep">
          {errorMessage(error)}
        </p>
      )}

      <Switch checked={profile.available} onChange={(available) => void saveChange({ available })} label={t.edit.available} />

      <form onSubmit={saveDate} className="space-y-2">
        <label htmlFor="lastDonated" className={labelClass}>
          {t.edit.lastDonated}
        </label>
        <div className="flex gap-2">
          <input
            id="lastDonated"
            type="date"
            max={todayIso()}
            value={dateDraft}
            onChange={(e) => setDateDraft(e.target.value)}
            onBlur={() => {
              // Browsers report "" for a half-typed date, so blur only saves a complete one.
              if (dateDraft && dateDraft !== (profile.lastDonated ?? "")) commitDate();
            }}
            className={inputClass}
          />
          <button type="submit" className={`${btnSecondary} shrink-0 px-4`} disabled={dateDraft === (profile.lastDonated ?? "")}>
            {t.edit.saveDate}
          </button>
        </div>
      </form>

      <AreaAutocomplete
        value={profile.area}
        onChange={(area) => {
          if (area && area !== profile.area) void saveChange({ area });
        }}
        label={t.edit.area}
        required
      />

      <AvatarPicker value={profile.avatar ?? null} onChange={(avatar) => void saveChange({ avatar })} />

      <LocationField value={profile.location} onChange={(location) => void saveChange({ location })} copy={t.edit.location} />

      {ALLOW_PROFILE_CORRECTIONS && (
        <>
          <form onSubmit={saveName} className="space-y-2">
            <label htmlFor="edit-name" className={labelClass}>
              {t.edit.name}
            </label>
            <div className="flex gap-2">
              <input
                id="edit-name"
                value={nameDraft}
                maxLength={80}
                autoComplete="name"
                onChange={(e) => setNameDraft(e.target.value)}
                className={inputClass}
              />
              <button type="submit" className={`${btnSecondary} shrink-0 px-4`} disabled={nameDraft.trim() === profile.name}>
                {t.edit.saveName}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <label htmlFor="edit-bloodGroup" className={labelClass}>
              {t.edit.bloodGroup}
            </label>
            <select
              id="edit-bloodGroup"
              value={groupDraft ?? profile.bloodGroup}
              onChange={(e) => {
                const g = e.target.value;
                setGroupDraft(isBloodGroup(g) && g !== profile.bloodGroup ? g : null);
              }}
              className={inputClass}
            >
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {groupDraft && (
              <div className="space-y-3 rounded-xl border-2 border-accent bg-accent-soft p-4" role="alertdialog" aria-labelledby="bg-confirm">
                <p id="bg-confirm" className="text-base font-medium text-accent-deep">
                  {fmt(t.edit.bloodGroupConfirm, { group: groupDraft })}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={btnSecondary} onClick={() => setGroupDraft(null)}>
                    {t.form.cancel}
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      void saveChange({ bloodGroup: groupDraft });
                      setGroupDraft(null);
                    }}
                  >
                    {t.edit.bloodGroupYes}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div>
        {/* The whole phone block belongs to the link door; without it there is nothing to label. */}
        {transport.allowPhoneChange && <p className={labelClass}>{t.edit.phone}</p>}
        {transport.allowPhoneChange && phoneMode === "closed" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold">{formatLocalPhone(profile.phone)}</p>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setPhoneNotice(false);
                setError(null);
                setPhoneMode("input");
              }}
            >
              {t.edit.changePhone}
            </button>
          </div>
        )}
        {phoneNotice && phoneMode === "closed" && <p className="mt-1 text-sm text-muted">{t.edit.phoneUpdated}</p>}
        {transport.allowPhoneChange && phoneMode === "input" && (
          <form onSubmit={startPhoneChange} noValidate className="space-y-3">
            <label htmlFor="newPhone" className="sr-only">
              {t.edit.newPhone}
            </label>
            <input
              id="newPhone"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="01XXXXXXXXX"
              autoFocus
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btnSecondary} onClick={() => setPhoneMode("closed")}>
                {t.form.cancel}
              </button>
              <button type="submit" className={btnPrimary}>
                {t.edit.sendCode}
              </button>
            </div>
          </form>
        )}
        {transport.allowPhoneChange && phoneMode === "otp" && pendingPhone && (
          <OtpVerification phone={pendingPhone} purpose="change_phone" onVerified={onPhoneVerified} onCancel={() => setPhoneMode("input")} />
        )}
      </div>

      <div className="border-t border-line pt-5">
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-12 font-semibold text-accent-dark underline">
            {t.edit.delete}
          </button>
        ) : (
          <div className="space-y-3 rounded-xl border-2 border-accent bg-accent-soft p-4">
            <p className="text-base font-medium text-accent-deep">{t.edit.deleteConfirm}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btnSecondary} onClick={() => setConfirmDelete(false)}>
                {t.form.cancel}
              </button>
              <button type="button" className={btnPrimary} disabled={deleting} onClick={deleteProfile}>
                {deleting ? t.edit.deleting : t.edit.deleteYes}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
