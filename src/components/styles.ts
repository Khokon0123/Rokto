// Shared Tailwind class strings. Big, thumb-sized tap targets (56px+) and soft, rounded shapes.
export const inputClass =
  "block min-h-14 w-full rounded-2xl border border-line bg-surface px-4 text-base text-ink placeholder:text-muted/70";

export const btnPrimary =
  "inline-flex min-h-14 items-center justify-center rounded-2xl bg-accent px-6 text-base font-semibold text-white shadow-sm hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60";

export const btnSecondary =
  "inline-flex min-h-14 items-center justify-center rounded-2xl border border-line bg-surface px-6 text-base font-semibold text-ink hover:bg-page disabled:cursor-not-allowed disabled:opacity-60";

export const cardClass = "rounded-3xl border border-line bg-surface p-5 shadow-card";
export const labelClass = "mb-2 block text-sm font-semibold text-ink";
export const errorTextClass = "mt-2 text-sm font-medium text-accent-dark";

// The register flow sits straight on the red page, so its labels, buttons and errors are white-on-red.
export const labelOnRed = "mb-2 block text-base font-bold text-white";
export const errorOnRed = "mt-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-accent-dark";
export const btnOnRed =
  "inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-6 text-base font-extrabold text-accent shadow-sm hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60";
export const btnGhostOnRed =
  "inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/60 px-6 text-base font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";
