"use client";

import type { KeyboardEvent } from "react";

/** A2: WAI-ARIA tabs: arrow keys / Home / End move between tabs, panels are wired with ids. */
export default function AdminTabs<K extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: Array<{ key: K; label: string }>;
  active: K;
  onChange: (key: K) => void;
  label: string;
}) {
  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = tabs.length - 1;
    const map: Record<string, number> = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = tabs[map[e.key]];
    onChange(next.key);
    document.getElementById(`admin-tab-${next.key}`)?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-2 rounded-2xl bg-surface p-1 shadow-card">
      {tabs.map((tab, i) => (
        <button
          key={tab.key}
          id={`admin-tab-${tab.key}`}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          aria-controls={`admin-panel-${tab.key}`}
          tabIndex={active === tab.key ? 0 : -1}
          onKeyDown={(e) => onKey(e, i)}
          onClick={() => onChange(tab.key)}
          className={`min-h-11 flex-1 rounded-xl text-base font-semibold ${
            active === tab.key ? "bg-accent text-white" : "text-ink hover:bg-page"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
