"use client";

import { useState } from "react";
import { useErrorMessage } from "@/components/LocaleProvider";
import { getCurrentPosition, type GeoPoint } from "@/lib/geo";
import { btnSecondary, errorTextClass, labelClass } from "./styles";

type Status = "idle" | "locating" | "error";

export interface LocationFieldCopy {
  label: string;
  intro: string;
  action: string;
  locating: string;
  added: string;
  preview: string;
  remove: string;
}

/**
 * Shared by the register form and the edit page. Always optional, always shown with the same
 * plain-language trade-off, and the raw point here is only ever a same-device preview - the
 * server is what actually fuzzes it before anything is saved publicly.
 */
export default function LocationField({
  value,
  onChange,
  copy,
  disabled,
}: {
  value: GeoPoint | null;
  onChange: (v: GeoPoint | null) => void;
  copy: LocationFieldCopy;
  disabled?: boolean;
}) {
  const errorMessage = useErrorMessage();
  const [status, setStatus] = useState<Status>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  function useCurrentLocation() {
    setStatus("locating");
    setErrorCode(null);
    getCurrentPosition()
      .then((p) => {
        onChange(p);
        setStatus("idle");
      })
      .catch((err: Error) => {
        setStatus("error");
        setErrorCode(err.message);
      });
  }

  return (
    <div className="rounded-2xl border border-line bg-page p-4">
      <p className={labelClass}>{copy.label}</p>
      <p className="mb-3 text-sm text-muted">{copy.intro}</p>

      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-semibold text-ink">
            {copy.added} {"✓"}
          </span>
          <a
            href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-accent underline"
          >
            {copy.preview} {"↗"}
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="text-sm font-semibold text-accent-dark underline"
          >
            {copy.remove}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={disabled || status === "locating"}
          className={`${btnSecondary} w-full sm:w-auto`}
        >
          {status === "locating" ? copy.locating : copy.action}
        </button>
      )}
      {status === "error" && errorCode && <p className={errorTextClass}>{errorMessage(errorCode)}</p>}
    </div>
  );
}
