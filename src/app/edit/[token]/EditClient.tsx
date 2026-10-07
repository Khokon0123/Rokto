"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import BloodBadge from "@/components/BloodBadge";
import LocationField from "@/components/LocationField";
import OtpVerification from "@/components/OtpVerification";
import Switch from "@/components/Switch";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary, cardClass, inputClass, labelClass } from "@/components/styles";
import { apiCall } from "@/lib/api";
import { formatLocalPhone, normalizeBdPhone } from "@/lib/phone";
import type { EditableProfile } from "@/lib/types";
import { todayIso } from "@/lib/validation";

type Load = "loading" | "invalid" | "ready" | "deleted";
type Save = "idle" | "saving" | "saved";
type Patch = Partial<Pick<EditableProfile, "available" | "lastDonated" | "area" | "location">>;

export default function EditClient({ token }: { token: string }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [load, setLoad] = useState<Load>("loading");
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [save, setSave] = useState<Save>("idle");
  const [error, setError] = useState<string | null>(null);

  const [phoneMode, setPhoneMode] = useState<"closed" | "input" | "otp">("closed");
  const [phoneInput, setPhoneInput] = useState("");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [phoneNotice, setPhoneNotice] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiCall<{ profile: EditableProfile }>("/api/edit", "POST", { token }).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) {
        setProfile(res.data.profile);
        setLoad("ready");
      } else {
        setLoad("invalid");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  /** Optimistic: the UI updates instantly and rolls back if the save fails. */
  const saveChange = useCallback(
    async (patch: Patch) => {
      if (!profile) return;
      const before = profile;
      setProfile({ ...profile, ...patch });
      setError(null);
      setSave("saving");
      const res = await apiCall<{ profile: EditableProfile }>("/api/edit", "PATCH", { token, ...patch });
      if (res.ok && res.data) {
        setProfile(res.data.profile);
        setSave("saved");
      } else {
        setProfile(before);
        setSave("idle");
        setError(res.error ?? "generic");
      }
    },
    [profile, token],
  );

  function startPhoneChange(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeBdPhone(phoneInput);
    if (!normalized) {
      setError("phone_invalid");
      return;
    }
    if (normalized === profile?.phone) {
      setPhoneMode("closed");
      return;
    }
    setError(null);
    setPendingPhone(normalized);
    setPhoneMode("otp");
  }

  async function onPhoneVerified(proof: string) {
    setSave("saving");
    const res = await apiCall<{ profile: EditableProfile }>("/api/edit", "PATCH", {
      token,
      phone: pendingPhone,
      proof,
    });
    if (res.ok && res.data) {
      setProfile(res.data.profile);
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
    const res = await apiCall("/api/edit", "DELETE", { token });
    if (res.ok) {
      setLoad("deleted");
    } else {
      setDeleting(false);
      setError(res.error ?? "generic");
    }
  }

  if (load === "loading") return <p className="pt-6 text-base text-muted">{t.edit.loading}</p>;

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

      <Switch
        checked={profile.available}
        onChange={(available) => void saveChange({ available })}
        label={t.edit.available}
      />

      <div>
        <label htmlFor="lastDonated" className={labelClass}>
          {t.edit.lastDonated}
        </label>
        <input
          id="lastDonated"
          type="date"
          max={todayIso()}
          value={profile.lastDonated ?? ""}
          onChange={(e) => void saveChange({ lastDonated: e.target.value || null })}
          className={inputClass}
        />
      </div>

      <AreaAutocomplete
        value={profile.area}
        onChange={(area) => {
          if (area && area !== profile.area) void saveChange({ area });
        }}
        label={t.edit.area}
        required
      />

      <LocationField
        value={profile.location}
        onChange={(location) => void saveChange({ location })}
        copy={t.edit.location}
      />

      <div>
        <p className={labelClass}>{t.edit.phone}</p>
        {phoneMode === "closed" && (
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
        {phoneMode === "input" && (
          <form onSubmit={startPhoneChange} noValidate className="space-y-3">
            <label htmlFor="newPhone" className="sr-only">
              {t.edit.newPhone}
            </label>
            <input
              id="newPhone"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              inputMode="tel"
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
        {phoneMode === "otp" && pendingPhone && (
          <OtpVerification
            phone={pendingPhone}
            onVerified={onPhoneVerified}
            onCancel={() => setPhoneMode("input")}
          />
        )}
      </div>

      <div className="border-t border-line pt-5">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-12 font-semibold text-accent-dark underline"
          >
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
