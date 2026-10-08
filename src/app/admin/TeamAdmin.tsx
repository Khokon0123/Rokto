"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { btnPrimary, btnSecondary, cardClass, inputClass, labelClass } from "@/components/styles";
import { useErrorMessage, useT } from "@/components/LocaleProvider";
import TeamAvatar from "@/components/TeamAvatar";
import { apiCall } from "@/lib/api";
import { TEAM_PHOTO_SIZE, TEAM_SECTIONS, type TeamMember, type TeamMemberInput, type TeamSection } from "@/lib/team";

const EMPTY_FORM: TeamMemberInput = { name: "", role: "", section: "founding", photo: "", email: "", facebook: "" };

/** Center-crops and shrinks a picked image to a small square JPEG, so it can live right in Firestore. */
async function resizePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = TEAM_PHOTO_SIZE;
  canvas.height = TEAM_PHOTO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    TEAM_PHOTO_SIZE,
    TEAM_PHOTO_SIZE,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

interface TeamResult {
  ok: boolean;
  members?: TeamMember[];
  error?: string;
}

async function fetchTeam(): Promise<TeamResult> {
  try {
    const res = await fetch("/api/admin/team", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { members?: TeamMember[]; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "server_error" };
    return { ok: true, members: data.members ?? [] };
  } catch {
    return { ok: false, error: "network" };
  }
}

export default function TeamAdmin({ onUnauthorized }: { onUnauthorized: () => void }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null = form closed, "new" = adding, otherwise the id being edited
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<TeamMemberInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function apply(res: TeamResult): void {
    if (res.ok) setMembers(res.members ?? []);
    else if (res.error === "admin_unauthorized") onUnauthorized();
    else setError(res.error ?? "generic");
  }

  async function load(): Promise<void> {
    apply(await fetchTeam());
  }

  useEffect(() => {
    let cancelled = false;
    fetchTeam().then((res) => {
      if (!cancelled) apply(res);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleError(code: string | undefined, setter: (c: string) => void) {
    if (code === "admin_unauthorized") onUnauthorized();
    else setter(code ?? "generic");
  }

  function openForm(member: TeamMember | null, section?: TeamSection) {
    setFormError(null);
    setEditing(member ? member.id : "new");
    setForm(
      member
        ? { name: member.name, role: member.role, section: member.section, photo: member.photo, email: member.email, facebook: member.facebook }
        : { ...EMPTY_FORM, section: section ?? "founding" },
    );
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const photo = await resizePhoto(file);
      setForm((f) => ({ ...f, photo }));
      setFormError(null);
    } catch {
      setFormError("team_photo_invalid");
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const res =
      editing === "new"
        ? await apiCall("/api/admin/team", "POST", form)
        : await apiCall(`/api/admin/team/${editing}`, "PATCH", form);
    setSaving(false);
    if (!res.ok) return handleError(res.error, setFormError);
    setEditing(null);
    await load();
  }

  async function move(id: string, direction: "up" | "down") {
    setBusyId(id);
    const res = await apiCall(`/api/admin/team/${id}`, "PATCH", { move: direction });
    setBusyId(null);
    if (!res.ok) return handleError(res.error, setError);
    await load();
  }

  async function remove(id: string) {
    setBusyId(id);
    const res = await apiCall(`/api/admin/team/${id}`, "DELETE", {});
    setBusyId(null);
    setConfirmingId(null);
    if (!res.ok) return handleError(res.error, setError);
    setMembers((prev) => (prev ? prev.filter((m) => m.id !== id) : prev));
  }

  const sectionLabel = (s: TeamSection) => (s === "founding" ? t.team.founding : t.team.operations);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="/team" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent underline">
          {t.admin.teamViewPage} {"↗"}
        </a>
        <button type="button" onClick={() => openForm(null)} className={`${btnPrimary} min-h-11 px-4`}>
          + {t.admin.teamAdd}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-accent bg-accent-soft p-4 font-medium text-accent-deep">
          {errorMessage(error)}
        </p>
      )}

      {editing && (
        <form ref={formRef} onSubmit={save} className={`${cardClass} scroll-mt-4 space-y-4`}>
          <h2 className="text-xl font-bold text-ink">{editing === "new" ? t.admin.teamAddTitle : t.admin.teamEditTitle}</h2>

          <div className="flex items-center gap-4">
            <TeamAvatar name={form.name || "?"} photo={form.photo} />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileInput.current?.click()} className={`${btnSecondary} min-h-11 px-4`}>
                {form.photo ? t.admin.teamPhotoChange : t.admin.teamPhotoChoose}
              </button>
              {form.photo && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, photo: "" }))}
                  className="min-h-11 px-2 text-sm font-semibold text-accent underline"
                >
                  {t.admin.teamPhotoRemove}
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              aria-label={t.admin.teamPhoto}
              className="hidden"
              onChange={(e) => {
                void pickPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          <div>
            <label htmlFor="team-name" className={labelClass}>{t.admin.teamName}</label>
            <input
              id="team-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="team-role" className={labelClass}>{t.admin.teamRole}</label>
              <input
                id="team-role"
                required
                value={form.role}
                placeholder={t.admin.teamRolePlaceholder}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="team-section" className={labelClass}>{t.admin.teamSection}</label>
              <select
                id="team-section"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value as TeamSection })}
                className={inputClass}
              >
                {TEAM_SECTIONS.map((s) => (
                  <option key={s} value={s}>{sectionLabel(s)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="team-email" className={labelClass}>{t.admin.teamEmail}</label>
            <input
              id="team-email"
              type="email"
              value={form.email}
              placeholder="name@example.com"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="team-fb" className={labelClass}>{t.admin.teamFacebook}</label>
            <input
              id="team-fb"
              type="url"
              value={form.facebook}
              placeholder="https://www.facebook.com/..."
              onChange={(e) => setForm({ ...form, facebook: e.target.value })}
              className={inputClass}
            />
            <p className="mt-2 text-sm text-muted">{t.admin.teamContactHint}</p>
          </div>

          {formError && (
            <p role="alert" className="text-sm font-medium text-accent-dark">{errorMessage(formError)}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setEditing(null)} className={`${btnSecondary} flex-1`}>
              {t.admin.cancel}
            </button>
            <button type="submit" disabled={saving} className={`${btnPrimary} flex-1`}>
              {saving ? t.admin.teamSaving : t.admin.teamSave}
            </button>
          </div>
        </form>
      )}

      {members === null && !error && <p className="text-base text-muted">{t.admin.teamLoading}</p>}

      {members !== null &&
        TEAM_SECTIONS.map((section) => {
          const people = members.filter((m) => m.section === section);
          return (
            <section key={section} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-ink">{sectionLabel(section)}</h2>
                <button
                  type="button"
                  onClick={() => openForm(null, section)}
                  className="min-h-11 text-sm font-semibold text-accent underline"
                >
                  + {t.admin.teamAdd}
                </button>
              </div>
              {people.length === 0 && <p className="text-base text-muted">{t.admin.teamEmpty}</p>}
              <ul className="space-y-3">
                {people.map((m, i) => (
                  <li key={m.id} className={cardClass}>
                    <div className="flex items-center gap-4">
                      <TeamAvatar name={m.name} photo={m.photo} size={56} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-bold text-ink">{m.name}</p>
                        <p className="text-sm text-muted">{m.role}</p>
                        {m.email && <p className="truncate text-sm text-muted">{m.email}</p>}
                        {m.facebook && <p className="truncate text-sm text-muted">{m.facebook}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          aria-label={t.admin.teamMoveUp}
                          title={t.admin.teamMoveUp}
                          disabled={i === 0 || busyId === m.id}
                          onClick={() => void move(m.id, "up")}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink hover:bg-page disabled:opacity-30"
                        >
                          {"↑"}
                        </button>
                        <button
                          type="button"
                          aria-label={t.admin.teamMoveDown}
                          title={t.admin.teamMoveDown}
                          disabled={i === people.length - 1 || busyId === m.id}
                          onClick={() => void move(m.id, "down")}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink hover:bg-page disabled:opacity-30"
                        >
                          {"↓"}
                        </button>
                      </div>
                    </div>

                    {confirmingId === m.id ? (
                      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-page p-3">
                        <p className="flex-1 text-sm font-medium text-ink">{t.admin.teamConfirmDelete}</p>
                        <button type="button" onClick={() => setConfirmingId(null)} className={`${btnSecondary} min-h-11 px-4`}>
                          {t.admin.cancel}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === m.id}
                          onClick={() => void remove(m.id)}
                          className={`${btnPrimary} min-h-11 px-4`}
                        >
                          {busyId === m.id ? t.admin.deleting : t.admin.teamDeleteConfirm}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-5">
                        <button type="button" onClick={() => openForm(m)} className="min-h-11 text-sm font-semibold text-ink underline">
                          {t.admin.teamEdit}
                        </button>
                        <button type="button" onClick={() => setConfirmingId(m.id)} className="min-h-11 text-sm font-semibold text-accent underline">
                          {t.admin.delete}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}
