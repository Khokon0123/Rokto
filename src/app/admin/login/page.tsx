"use client";

import { useState, type FormEvent } from "react";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import { btnPrimary, cardClass, errorTextClass, inputClass, labelClass } from "@/components/styles";
import { apiCall } from "@/lib/api";

export default function AdminLoginPage() {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await apiCall<{ ok: boolean }>("/api/admin/login", "POST", { email, password });
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
          <label htmlFor="admin-email" className={labelClass}>
            {t.admin.email}
          </label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            inputMode="email"
            autoFocus
            className={inputClass}
          />
          <p className="mt-1 text-sm text-muted">{t.admin.emailHint}</p>
        </div>
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
