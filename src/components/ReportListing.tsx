"use client";

import { useState, type FormEvent } from "react";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import { REPORT_REASONS, type ReportReason } from "@/config/app";
import { apiCall } from "@/lib/api";
import { captchaHost } from "@/lib/reveal";
import { solveCaptcha } from "@/lib/turnstile";
import { btnPrimary, btnSecondary, errorTextClass, inputClass, labelClass } from "./styles";

/** "Report this listing" (L2): wrong number, not registered by the owner, harassment. */
export default function ReportListing({ donorId }: { donorId: string }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("wrong_number");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const formId = `report-${donorId}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    let captcha: string | null = null;
    try {
      captcha = await solveCaptcha(captchaHost(), "report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "captcha_failed");
      setState("idle");
      return;
    }
    const res = await apiCall(`/api/donors/${encodeURIComponent(donorId)}/report`, "POST", { reason, note, captcha });
    if (res.ok) setState("sent");
    else {
      setError(res.error ?? "generic");
      setState("idle");
    }
  }

  if (state === "sent") return <p className="mt-3 text-sm font-medium text-muted" role="status">{t.report.sent}</p>;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls={formId}
        className="mt-3 min-h-11 text-sm text-muted underline"
      >
        {t.card.report}
      </button>
    );
  }

  return (
    <form id={formId} onSubmit={submit} className="mt-3 space-y-3 rounded-2xl bg-page p-4">
      <p className="text-base font-semibold text-ink">{t.report.title}</p>
      <p className="text-sm text-muted">{t.report.intro}</p>
      <div>
        <label htmlFor={`${formId}-reason`} className={labelClass}>
          {t.report.reason}
        </label>
        <select
          id={`${formId}-reason`}
          value={reason}
          onChange={(e) => setReason(e.target.value as ReportReason)}
          className={inputClass}
        >
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {t.report[r]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${formId}-note`} className={labelClass}>
          {t.report.note}
        </label>
        <textarea
          id={`${formId}-note`}
          value={note}
          maxLength={500}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          className={`${inputClass} py-3`}
        />
      </div>
      {error && (
        <p role="alert" className={errorTextClass}>
          {errorMessage(error)}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
          {t.report.cancel}
        </button>
        <button type="submit" className={btnPrimary} disabled={state === "sending"}>
          {state === "sending" ? t.report.sending : t.report.submit}
        </button>
      </div>
    </form>
  );
}
