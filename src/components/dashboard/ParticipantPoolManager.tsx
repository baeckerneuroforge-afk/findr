"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, FIELD_INPUT_CLASS, FIELD_TEXTAREA_CLASS } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

/**
 * Pflege-Surface für den org-weiten Teilnehmer-Pool. Hält die Liste nach dem
 * Initial-Load im lokalen State und aktualisiert sie direkt aus den API-
 * Antworten (create gibt den neuen Eintrag zurück, patch den geänderten,
 * delete bestätigt die ID). Damit ist die Komponente nach dem Mount autoritativ
 * — kein router.refresh nötig, und Filtern läuft client-seitig über den State.
 *
 * Screening ist rein deterministisch: role / segment / tags sind freie
 * Attribute, die der Nutzer setzt. Keine KI.
 *
 * Der Typ spiegelt PoolMemberRecord aus dem (server-only) Service; hier lokal
 * definiert, damit die Client-Komponente nicht aus einem server-only-Modul
 * importiert.
 */

export interface PoolMember {
  id: string;
  contactLabel: string;
  contactEmail: string | null;
  role: string | null;
  segment: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALL = "__all__";

/** Tag-Eingabe ("B2B, Founder; Enterprise") → normalisiertes, dedupliziertes
 *  Array. Trennt an Komma / Semikolon / Zeilenumbruch. */
function parseTags(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[,;\n]/)
        .map((t) => t.trim())
        .filter((t) => t !== ""),
    ),
  ];
}

interface FormValues {
  contactLabel: string;
  contactEmail: string;
  role: string;
  segment: string;
  tagsInput: string;
  notes: string;
}

function memberToForm(m: PoolMember): FormValues {
  return {
    contactLabel: m.contactLabel,
    contactEmail: m.contactEmail ?? "",
    role: m.role ?? "",
    segment: m.segment ?? "",
    tagsInput: m.tags.join(", "),
    notes: m.notes ?? "",
  };
}

const EMPTY_FORM: FormValues = {
  contactLabel: "",
  contactEmail: "",
  role: "",
  segment: "",
  tagsInput: "",
  notes: "",
};

type SubmitOutcome = { ok: true; member: PoolMember } | { ok: false; error: string };

// ── Shared field block (create + edit) ───────────────────────────────────────

function PoolMemberFields({
  values,
  onChange,
  disabled,
}: {
  values: FormValues;
  onChange: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Name" required hint='Anzeige-Label. "Vorname Nachname" oder "Name, Firma".'>
        <input
          value={values.contactLabel}
          onChange={(e) => onChange("contactLabel", e.target.value)}
          placeholder="Jane Doe, Acme"
          disabled={disabled}
          className={FIELD_INPUT_CLASS}
        />
      </Field>
      <Field label="E-Mail" hint="Optional. Ohne E-Mail kein Mailversand – Link kopieren geht trotzdem.">
        <input
          type="email"
          value={values.contactEmail}
          onChange={(e) => onChange("contactEmail", e.target.value)}
          placeholder="jane@acme.example"
          disabled={disabled}
          className={FIELD_INPUT_CLASS}
        />
      </Field>
      <Field label="Rolle" hint="Screening-Attribut, z. B. „Head of Sales“. Quoten greifen auf die Rolle zu.">
        <input
          value={values.role}
          onChange={(e) => onChange("role", e.target.value)}
          placeholder="Head of Sales"
          disabled={disabled}
          className={FIELD_INPUT_CLASS}
        />
      </Field>
      <Field label="Segment" hint="Screening-Attribut, z. B. „Enterprise“ oder „B2B SaaS“.">
        <input
          value={values.segment}
          onChange={(e) => onChange("segment", e.target.value)}
          placeholder="Enterprise"
          disabled={disabled}
          className={FIELD_INPUT_CLASS}
        />
      </Field>
      <Field label="Tags" hint="Komma-getrennt. Mehrfach-Eigenschaften zum Filtern, z. B. „Bestandskunde, Power-User“.">
        <input
          value={values.tagsInput}
          onChange={(e) => onChange("tagsInput", e.target.value)}
          placeholder="Bestandskunde, Power-User"
          disabled={disabled}
          className={FIELD_INPUT_CLASS}
        />
      </Field>
      <Field label="Notiz" hint="Optional. Recruiting-Kontext, Quelle, etc.">
        <textarea
          value={values.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          rows={2}
          disabled={disabled}
          className={FIELD_TEXTAREA_CLASS}
        />
      </Field>
    </div>
  );
}

/** Eigenständiges Form-Stück mit eigenem Feld-State, für Anlegen UND Bearbeiten.
 *  Validiert Pflichtfeld + Email-Form client-seitig, baut den Request-Body und
 *  delegiert den eigentlichen Call an `onSubmit`. */
function PoolMemberForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
}: {
  initial?: PoolMember;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (body: Record<string, unknown>) => Promise<SubmitOutcome>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<FormValues>(
    initial ? memberToForm(initial) : EMPTY_FORM,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onChange<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((cur) => ({ ...cur, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const contactLabel = values.contactLabel.trim();
    if (contactLabel === "") {
      setError("Name ist erforderlich.");
      return;
    }
    const contactEmail = values.contactEmail.trim();
    if (contactEmail !== "" && !EMAIL_RE.test(contactEmail)) {
      setError("Die E-Mail-Adresse sieht nicht gültig aus.");
      return;
    }

    setSubmitting(true);
    try {
      const outcome = await onSubmit({
        contactLabel,
        contactEmail: contactEmail === "" ? null : contactEmail,
        role: values.role.trim() === "" ? null : values.role.trim(),
        segment: values.segment.trim() === "" ? null : values.segment.trim(),
        tags: parseTags(values.tagsInput),
        notes: values.notes.trim() === "" ? null : values.notes.trim(),
      });
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      if (!initial) setValues(EMPTY_FORM); // create: clear for the next entry
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PoolMemberFields values={values} onChange={onChange} disabled={submitting} />
      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Abbrechen
          </Button>
        )}
      </div>
    </form>
  );
}

// ── Manager ───────────────────────────────────────────────────────────────────

export function ParticipantPoolManager({ initialMembers }: { initialMembers: PoolMember[] }) {
  const [members, setMembers] = useState<PoolMember[]>(initialMembers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>(ALL);
  const [filterSegment, setFilterSegment] = useState<string>(ALL);
  const [filterTag, setFilterTag] = useState<string>(ALL);

  const roles = useMemo(
    () => [...new Set(members.map((m) => m.role).filter((r): r is string => !!r))].sort(),
    [members],
  );
  const segments = useMemo(
    () => [...new Set(members.map((m) => m.segment).filter((s): s is string => !!s))].sort(),
    [members],
  );
  const tags = useMemo(
    () => [...new Set(members.flatMap((m) => m.tags))].sort(),
    [members],
  );

  const filtered = useMemo(
    () =>
      members.filter((m) => {
        if (filterRole !== ALL && m.role !== filterRole) return false;
        if (filterSegment !== ALL && m.segment !== filterSegment) return false;
        if (filterTag !== ALL && !m.tags.includes(filterTag)) return false;
        return true;
      }),
    [members, filterRole, filterSegment, filterTag],
  );

  async function createMember(body: Record<string, unknown>): Promise<SubmitOutcome> {
    const res = await fetch("/api/research/pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { member?: PoolMember; error?: string };
    if (!res.ok || !data.member) {
      return { ok: false, error: data.error ?? "Anlegen fehlgeschlagen." };
    }
    setMembers((cur) => [data.member as PoolMember, ...cur]);
    return { ok: true, member: data.member };
  }

  async function updateMember(id: string, body: Record<string, unknown>): Promise<SubmitOutcome> {
    const res = await fetch(`/api/research/pool/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { member?: PoolMember; error?: string };
    if (!res.ok || !data.member) {
      return { ok: false, error: data.error ?? "Speichern fehlgeschlagen." };
    }
    setMembers((cur) => cur.map((m) => (m.id === id ? (data.member as PoolMember) : m)));
    setEditingId(null);
    return { ok: true, member: data.member };
  }

  async function deleteMember(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/research/pool/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMembers((cur) => cur.filter((m) => m.id !== id));
        if (editingId === id) setEditingId(null);
      }
    } finally {
      setDeletingId(null);
    }
  }

  const filtersActive =
    filterRole !== ALL || filterSegment !== ALL || filterTag !== ALL;

  const editingMember = members.find((m) => m.id === editingId) ?? null;

  return (
    <div className="space-y-8">
      {/* Anlegen */}
      <Card>
        <CardHeader>
          <h3 className="text-h3 text-neutral-900">Person zum Pool hinzufügen</h3>
        </CardHeader>
        <CardBody>
          <PoolMemberForm
            submitLabel="Zum Pool hinzufügen"
            pendingLabel="Lege an…"
            onSubmit={createMember}
          />
        </CardBody>
      </Card>

      {/* Bearbeiten — erscheint als eigene Karte, sobald in einer Zeile
          „Bearbeiten“ geklickt wird. key pro Member, damit der Feld-State
          beim Wechsel des Ziels frisch initialisiert. */}
      {editingMember && (
        <Card>
          <CardHeader>
            <h3 className="text-h3 text-neutral-900">
              Eintrag bearbeiten · {editingMember.contactLabel}
            </h3>
          </CardHeader>
          <CardBody>
            <PoolMemberForm
              key={editingMember.id}
              initial={editingMember}
              submitLabel="Speichern"
              pendingLabel="Speichere…"
              onSubmit={(body) => updateMember(editingMember.id, body)}
              onCancel={() => setEditingId(null)}
            />
          </CardBody>
        </Card>
      )}

      {/* Liste + Filter */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-h3 text-neutral-900">
              Pool · {members.length} {members.length === 1 ? "Person" : "Personen"}
            </h3>
            <p className="text-small text-neutral-500">
              {filtersActive
                ? `${filtered.length} gefiltert angezeigt.`
                : "Wiederverwendbar über alle Studien – aus jeder Studie heraus einladbar."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-small">
              <span className="mb-1 block text-caption text-neutral-500">Rolle</span>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className={FIELD_INPUT_CLASS}
              >
                <option value={ALL}>Alle</option>
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="text-small">
              <span className="mb-1 block text-caption text-neutral-500">Segment</span>
              <select
                value={filterSegment}
                onChange={(e) => setFilterSegment(e.target.value)}
                className={FIELD_INPUT_CLASS}
              >
                <option value={ALL}>Alle</option>
                {segments.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-small">
              <span className="mb-1 block text-caption text-neutral-500">Tag</span>
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className={FIELD_INPUT_CLASS}
              >
                <option value={ALL}>Alle</option>
                {tags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            {filtersActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterRole(ALL);
                  setFilterSegment(ALL);
                  setFilterTag(ALL);
                }}
              >
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </div>

        {members.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-6 text-center text-body text-neutral-500">
                Noch keine Personen im Pool. Oben hinzufügen, dann aus jeder Studie
                heraus einladen.
              </p>
            </CardBody>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-6 text-center text-body text-neutral-500">
                Keine Person passt zu den Filtern.
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>E-Mail</TH>
                  <TH>Rolle</TH>
                  <TH>Segment</TH>
                  <TH>Tags</TH>
                  <TH>Aktionen</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((m) => (
                  <TR key={m.id} className={editingId === m.id ? "bg-primary-50/40" : ""}>
                    <TD className="text-body-strong text-neutral-900">
                      {m.contactLabel}
                      {m.notes && (
                        <div className="mt-0.5 line-clamp-1 text-caption font-normal text-neutral-400">
                          {m.notes}
                        </div>
                      )}
                    </TD>
                    <TD className="text-neutral-700">
                      {m.contactEmail ?? <span className="text-neutral-400">—</span>}
                    </TD>
                    <TD className="text-neutral-700">
                      {m.role ?? <span className="text-neutral-400">—</span>}
                    </TD>
                    <TD className="text-neutral-700">
                      {m.segment ?? <span className="text-neutral-400">—</span>}
                    </TD>
                    <TD>
                      {m.tags.length === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {m.tags.map((t) => (
                            <Badge key={t} variant="default">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(m.id)}
                        >
                          Bearbeiten
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMember(m.id)}
                          disabled={deletingId === m.id}
                        >
                          {deletingId === m.id ? "Lösche…" : "Löschen"}
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}
