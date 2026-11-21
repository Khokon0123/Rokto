"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import { btnPrimary, btnSecondary, cardClass, errorTextClass, inputClass, labelClass } from "@/components/styles";
import { apiCall } from "@/lib/api";
import { normalizeUsername } from "@/lib/username";

/** The search page's door: a username instead of a phone number. No username yet -> /register. */
export default function UsernameSignIn({ registerHref }: { registerHref: string }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const username = normalizeUsername(value);
    if (!username) return setError("username_invalid");
    setError(null);
    setBusy(true);
    const res = await apiCall("/api/account/login", "POST", { username });
    if (res.ok) {
      // The page is a server render of the cookie: refresh it and the search appears in place,
      // filters in the address bar untouched.
      router.refresh();
      return;
    }
    setError(res.error ?? "generic");
    setBusy(false);
  }

  return (
    <div className={`${cardClass} space-y-5`}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <p className="text-base leading-relaxed text-muted">{t.signin.usernameLede}</p>
        <div>
          <label htmlFor="username" className={labelClass}>
            {t.signin.usernameLabel}
          </label>
          <input
            id="username"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="shanto-alo-4721"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "username-error" : undefined}
            className={inputClass}
          />
          {error && (
            <p id="username-error" role="alert" className={errorTextClass}>
              {errorMessage(error)}
            </p>
          )}
        </div>
        <button type="submit" disabled={busy || !value.trim()} className={`${btnPrimary} w-full`}>
          {busy ? t.signin.usernameSubmitting : t.signin.usernameSubmit}
        </button>
      </form>
      <div className="border-t border-line pt-4">
        <p className="text-sm text-muted">{t.signin.noUsername}</p>
        <Link href={registerHref} className={`${btnSecondary} mt-2 w-full`}>
          {t.signin.noUsernameCta}
        </Link>
      </div>
    </div>
  );
}
