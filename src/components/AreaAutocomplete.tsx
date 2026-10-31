"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { areaLabel, filterAreas, getArea, type Area, type AreaGroup } from "@/lib/areas";
import { errorTextClass, inputClass, labelClass } from "./styles";

interface Props {
  /** Selected area id, or null. Only ids from the static list can ever be emitted. */
  value: string | null;
  onChange: (areaId: string | null) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
  /** Fixed id for the text input, so a form can move focus to it after a failed submit (A1). */
  id?: string;
}

/**
 * Autocomplete combobox over the static Chittagong area list. Shared by the homepage search and
 * the donor register / edit forms. Free text is never emitted: search depends on donor profiles
 * and queries holding exactly the same area ids, so typing only filters; you must pick a row.
 */
export default function AreaAutocomplete({ value, onChange, label, placeholder, required, error, id }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const labelOf = (a: Area) => areaLabel(a.id, locale);
  const GROUP_LABEL: Record<AreaGroup, string> = {
    city: t.area.groupCity,
    district: t.area.groupDistrict,
  };
  const uid = useId();
  const inputId = id ?? `${uid}-input`;
  const listId = `${uid}-list`;
  const optionId = (areaId: string) => `${uid}-opt-${areaId}`;

  const selected = value ? getArea(value) : undefined;
  const selectedLabel = selected ? labelOf(selected) : "";

  const [text, setText] = useState(selectedLabel);
  const [prevLabel, setPrevLabel] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false); // filter only after the user types
  const [activeIndex, setActiveIndex] = useState(0);

  // Parent changed the value (e.g. form reset, profile loaded): show its label.
  if (selectedLabel !== prevLabel) {
    setPrevLabel(selectedLabel);
    setText(selectedLabel);
  }

  const matches = useMemo(() => filterAreas(typed ? text : ""), [typed, text]);
  const groups = useMemo(
    () =>
      (["city", "district"] as const)
        .map((group) => ({ group, items: matches.filter((a) => a.group === group) }))
        .filter((g) => g.items.length > 0),
    [matches],
  );
  const flat: Area[] = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const active = flat[Math.min(activeIndex, Math.max(flat.length - 1, 0))];

  function scrollIntoView(area: Area | undefined) {
    if (area) document.getElementById(optionId(area.id))?.scrollIntoView({ block: "nearest" });
  }

  function choose(area: Area) {
    setText(labelOf(area));
    setPrevLabel(labelOf(area));
    setTyped(false);
    setOpen(false);
    onChange(area.id);
  }

  function closeAndRestore() {
    setOpen(false);
    setTyped(false);
    if (text.trim() === "" && !required) {
      if (value !== null) onChange(null); // optional field (e.g. search): empty means "all areas"
      setText("");
    } else {
      setText(selectedLabel); // discard unmatched free text
    }
  }

  function move(delta: number) {
    if (!open) {
      setOpen(true);
      return;
    }
    if (flat.length === 0) return;
    const next = (activeIndex + delta + flat.length) % flat.length;
    setActiveIndex(next);
    scrollIntoView(flat[next]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault(); // never submit the form from inside the list
        if (active) choose(active);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setTyped(false);
        setText(selectedLabel);
      }
    }
  }

  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && closeAndRestore()}>
      <label htmlFor={inputId} className={labelClass}>
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active ? optionId(active.id) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-error` : undefined}
          aria-required={required}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          value={text}
          placeholder={placeholder}
          className={`${inputClass} pr-12 ${error ? "border-accent" : ""}`}
          onChange={(e) => {
            setText(e.target.value);
            setTyped(true);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {text !== "" && (
          <button
            type="button"
            aria-label={t.area.clear}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-2xl text-muted hover:text-ink"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setText("");
              setPrevLabel("");
              setTyped(false);
              onChange(null);
              document.getElementById(inputId)?.focus();
            }}
          >
            <span aria-hidden>×</span>
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-surface shadow-card"
        >
          {flat.length === 0 ? (
            <li role="presentation" className="px-3 py-3 text-base text-muted">
              {t.area.noMatch}
            </li>
          ) : (
            groups.map(({ group, items }) => (
              <li key={group} role="presentation">
                <div className="sticky top-0 bg-page px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                  {GROUP_LABEL[group]}
                </div>
                <ul role="presentation">
                  {items.map((area) => (
                    <li
                      key={area.id}
                      id={optionId(area.id)}
                      role="option"
                      aria-selected={area.id === value}
                      className={`flex min-h-14 cursor-pointer items-center px-4 text-base ${
                        area.id === active?.id ? "bg-accent-soft text-accent-deep" : "text-ink"
                      } ${area.id === value ? "font-semibold" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(flat.indexOf(area))}
                      onClick={() => choose(area)}
                    >
                      {labelOf(area)}
                    </li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>
      )}

      {error && (
        <p id={`${uid}-error`} className={errorTextClass}>
          {error}
        </p>
      )}
    </div>
  );
}
