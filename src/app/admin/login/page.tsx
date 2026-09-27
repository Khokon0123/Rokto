"use client";

import { useState, type FormEvent } from "react";
import { btnPrimary, cardClass, errorTextClass, inputClass, labelClass } from "@/components/styles";
import { errorMessage, t } from "@/i18n";
import { apiCall } from "@/lib/api";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await apiCall<{ ok: boolean }>("/api/admin/login", "POST", { password });
    if (res.ok) {
      // Hard navigation, not router.push: the next page is a Server Component that reads the
      // cookie we just got, and a client-side nav can beat that cookie to the router's cache.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/admin";
    } else {
      setError(res.error ?? "generic");
      setBusy(false);
    }
  }

  return (
    <div className="relative -mt-14">
      <form onSubmit={onSubmit} noValidate className={`${cardClass} space-y-5`}>
        <h1 className="text-2xl font-bold text-ink">{t.admin.loginTitle}</h1>
        {error && (
          <p role="alert" className={errorTextClass}>
            {errorMessage(error)}
          </p>
        )}
        <div>
          <label htmlFor="admin-password" className={labelClass}>
            {t.admin.password}
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={busy || !password} className={`${btnPrimary} w-full`}>
          {busy ? t.admin.loggingIn : t.admin.login}
        </button>
      </form>
    </div>
  );
}
