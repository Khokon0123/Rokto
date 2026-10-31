"use client";

import { useState, type KeyboardEvent } from "react";
import { useT } from "@/components/LocaleProvider";
import { cardClass } from "@/components/styles";
import TeamAvatar from "@/components/TeamAvatar";
import { TEAM_SECTIONS, type TeamMember, type TeamSection } from "@/lib/team";

// Same pattern as /register and /search: the page headline lives in the red hero band
// (SiteHeader), so this content starts with a negative margin to sit under it.
export default function TeamClient({ members }: { members: TeamMember[] | null }) {
  const t = useT();
  const list = members ?? [];
  const tabs = TEAM_SECTIONS.map((section) => ({
    section,
    label: section === "founding" ? t.team.founding : t.team.operations,
    people: list.filter((m) => m.section === section),
  })).filter((tab) => tab.people.length > 0);
  const [active, setActive] = useState<TeamSection>(tabs[0]?.section ?? "founding");
  const current = tabs.find((tab) => tab.section === active) ?? tabs[0];

  // A2: arrow keys move between tabs; only the selected tab is in the Tab order.
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(tabs[next].section);
    document.getElementById(`tab-${tabs[next].section}`)?.focus();
  }

  if (members === null) {
    return (
      <div className="relative -mt-14">
        <p role="alert" className={cardClass}>
          {t.team.unavailable}
        </p>
      </div>
    );
  }

  return (
    <div className="relative -mt-14 space-y-5">
      <div className={`${cardClass} space-y-5`}>
        {tabs.length > 1 && (
          <div role="tablist" aria-label={t.hero.team} className="flex gap-1 rounded-2xl bg-page p-1">
            {tabs.map((tab, index) => (
              <button
                key={tab.section}
                id={`tab-${tab.section}`}
                type="button"
                role="tab"
                aria-selected={tab.section === current?.section}
                aria-controls={`panel-${tab.section}`}
                tabIndex={tab.section === current?.section ? 0 : -1}
                onKeyDown={(e) => onTabKey(e, index)}
                onClick={() => setActive(tab.section)}
                className={`min-h-12 flex-1 rounded-xl px-3 text-base font-semibold motion-safe:transition-colors ${
                  tab.section === current?.section ? "bg-accent text-white shadow-sm" : "text-ink hover:bg-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {current && (
          <div
            id={`panel-${current.section}`}
            role="tabpanel"
            aria-labelledby={`tab-${current.section}`}
            className="space-y-5"
          >
            <p className="text-base text-muted">
              {current.section === "operations" ? t.team.operationsIntro : t.team.intro}
            </p>
            <ul className="space-y-4">
              {current.people.map((person) => (
                <li key={person.id}>
                  <Person person={person} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function PersonRow({ person, hint }: { person: TeamMember; hint?: string }) {
  return (
    <div className="flex items-center gap-4">
      <TeamAvatar name={person.name} photo={person.photo} />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-lg font-bold text-ink">{person.name}</p>
        <p className="text-base text-muted">{person.role}</p>
        {hint && <p className="mt-1 text-sm font-semibold text-accent">{hint}</p>}
      </div>
    </div>
  );
}

// People with an email or Facebook link can be tapped to reveal them; everyone else is a plain row.
function Person({ person }: { person: TeamMember }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { email, facebook } = person;
  if (!email && !facebook) return <PersonRow person={person} />;
  const panelId = `contact-${person.id}`;

  return (
    <div className="rounded-2xl border border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 rounded-2xl p-3 hover:bg-page"
      >
        <div className="min-w-0 flex-1">
          <PersonRow person={person} hint={open ? t.team.hideContact : t.team.tapToContact} />
        </div>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-5 w-5 shrink-0 text-muted motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="space-y-2 border-t border-line p-3">
          {email && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent("Rokto - help / feedback")}`}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-page px-4 hover:bg-line/40"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-accent">
                <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Zm2 .9V17h14V7.4l-7 5-7-5Zm1.6-.4L12 10.8 17.4 7H6.6Z" fill="currentColor" />
              </svg>
              <span className="min-w-0">
                <span className="block text-sm text-muted">{t.team.email}</span>
                <span className="block break-all text-base font-semibold text-ink">{email}</span>
              </span>
            </a>
          )}
          {facebook && (
            <a
              href={facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-page px-4 hover:bg-line/40"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-[#1877F2]">
                <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z" fill="currentColor" />
              </svg>
              <span className="min-w-0">
                <span className="block text-sm text-muted">{t.team.facebook}</span>
                <span className="block truncate text-base font-semibold text-ink">{person.name}</span>
              </span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
