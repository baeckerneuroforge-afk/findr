"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FIELD_INPUT_CLASS } from "@/components/ui/Field";

/**
 * Inline "+ Teilnehmer hinzufügen" form for the plan-detail page. Mirrors
 * ResearchPlanForm: client component, useState for form / submitting /
 * error, fetch POST to /api/research/plans/[id]/invites, then
 * router.refresh so the server-rendered invite list picks up the new row.
 *
 * Scope: single-invite Anlage. The Bulk-Paste flow lives in
 * BulkInviteForm (same plan-detail Card section, two side-by-side ways
 * to land participants). Status is 'pending' at creation; scheduling +
 * sending the mail are separate per-row actions on the table.
 *
 * E-Mail ist optional — der Send-Button bleibt für Rows ohne E-Mail
 * deaktiviert (gating in SendInviteAction), aber alles andere (Link
 * kopieren, Termin setzen, Löschen) funktioniert ohne.
 *
 * The agent currently only handles the text mode end-to-end; voice and
 * video are accepted as the participant's preference and stored, but the
 * /interview/[token] page renders all three the same way today.
 */

type Mode = "text" | "voice" | "video";

const MODE_OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: "text", label: "Text-Chat" },
  { value: "voice", label: "Voice (Wunsch – heute Text-Fallback)" },
  { value: "video", label: "Video (Wunsch – heute Text-Fallback)" },
];

interface FormState {
  contactLabel: string;
  contactEmail: string;
  modePreference: Mode;
}

const INITIAL_FORM: FormState = {
  contactLabel: "",
  contactEmail: "",
  modePreference: "text",
};

export function InviteForm({ planId }: { planId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const contactLabel = form.contactLabel.trim();
    if (contactLabel.length === 0) {
      setError("Name ist erforderlich.");
      return;
    }

    // Email is optional, but if given, do a quick client-side shape check so
    // the user doesn't see the API's generic Zod error.
    const contactEmail = form.contactEmail.trim();
    if (contactEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError("Die E-Mail-Adresse sieht nicht gültig aus.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/research/plans/${planId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactLabel,
          contactEmail: contactEmail === "" ? null : contactEmail,
          modePreference: form.modePreference,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        inviteId?: string;
      };
      if (!res.ok || !data.inviteId) {
        throw new Error(data.error ?? "Teilnehmer konnte nicht hinzugefügt werden.");
      }
      setForm(INITIAL_FORM);
      // Server-rendered list refresh — picks up the new invite without a
      // full page reload.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Teilnehmer konnte nicht hinzugefügt werden.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Name"
          required
          hint='In der Teilnehmerliste angezeigt. "Vorname Nachname" oder "Name, Firma" sind beide ok.'
        >
          <input
            value={form.contactLabel}
            onChange={(e) => update("contactLabel", e.target.value)}
            placeholder="Jane Doe, Acme"
            disabled={submitting}
            className={FIELD_INPUT_CLASS}
          />
        </Field>

        <Field
          label="E-Mail"
          hint="Optional. Ohne E-Mail kein Mailversand – Link kopieren funktioniert trotzdem."
        >
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            placeholder="jane@acme.example"
            disabled={submitting}
            className={FIELD_INPUT_CLASS}
          />
        </Field>

        <Field
          label="Modus-Wunsch"
          hint="Wird als Wunsch des Teilnehmers gespeichert – heute ist nur Text vollständig verdrahtet."
        >
          <select
            value={form.modePreference}
            onChange={(e) =>
              update("modePreference", e.target.value as Mode)
            }
            disabled={submitting}
            className={FIELD_INPUT_CLASS}
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Lege an…" : "Teilnehmer hinzufügen"}
        </Button>
        <span className="text-small text-neutral-500">
          Wird als „ausstehend" gespeichert – Termin + Versand erfolgen pro
          Zeile.
        </span>
      </div>
    </form>
  );
}
