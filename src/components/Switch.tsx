"use client";

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/** Large accessible toggle (role="switch") for one-thumb use. */
export default function Switch({ checked, onChange, label, hint, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 text-left disabled:opacity-60"
    >
      <span>
        <span className="block text-base font-semibold text-ink">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full ${checked ? "bg-accent" : "bg-line"}`}
      >
        <span
          className={`inline-block h-6 w-6 rounded-full bg-white shadow ${checked ? "translate-x-7" : "translate-x-1"}`}
        />
      </span>
    </button>
  );
}
