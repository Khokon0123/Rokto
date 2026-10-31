"use client";

import { useState } from "react";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import { fmt } from "@/i18n";
import { formatLocalPhone } from "@/lib/phone";
import { revealDonorPhone } from "@/lib/reveal";
import { errorTextClass } from "./styles";

/**
 * The donor's Call button. In "tap" mode (S2) the number is fetched for this one donor on the
 * first tap, then the button becomes a normal tel: link. `disabled` is used while results are stale (F1).
 */
export default function CallButton({
  donorId,
  phone: initialPhone,
  className,
  disabled = false,
  linkClassName,
}: {
  donorId: string;
  phone: string;
  className: string;
  disabled?: boolean;
  linkClassName?: string;
}) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [phone, setPhone] = useState(initialPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (phone) {
    const label = fmt(t.card.call, { phone: formatLocalPhone(phone) });
    return disabled ? (
      <span aria-disabled="true" className={`${className} pointer-events-none opacity-50`}>
        {label}
      </span>
    ) : (
      <a href={`tel:${phone}`} className={linkClassName ?? className}>
        {label}
      </a>
    );
  }

  async function reveal() {
    setBusy(true);
    setError(null);
    const res = await revealDonorPhone(donorId);
    setBusy(false);
    if (res.phone) setPhone(res.phone);
    else setError(res.error ?? "generic");
  }

  return (
    <>
      <button type="button" onClick={reveal} disabled={busy || disabled} className={className}>
        {busy ? t.card.revealing : t.card.showNumber}
      </button>
      {error && (
        <p role="alert" className={errorTextClass}>
          {errorMessage(error)}
        </p>
      )}
    </>
  );
}
