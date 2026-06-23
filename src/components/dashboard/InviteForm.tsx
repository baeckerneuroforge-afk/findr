"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
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
 * Two interview modes are offered: text (chat) and voice (the spoken agent),
 * both handled end-to-end. Video is intentionally NOT offered yet — the DB
 * schema reserves a 'video' mode for later, but no video interview flow is
 * built, so surfacing it here would silently degrade the participant to text.
 * Re-add the option (and its i18n key) once the video flow actually ships.
 */

type Mode = "text" | "voice";

const MODE_OPTIONS: Array<{ value: Mode; labelKey: string }> = [
  { value: "text", labelKey: "modeText" },
  { value: "voice", labelKey: "modeVoice" },
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
  const t = useTranslations("research.plans");
  const tc = useTranslations("research.common");
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
      setError(tc("errName"));
      return;
    }

    // Email is optional, but if given, do a quick client-side shape check so
    // the user doesn't see the API's generic Zod error.
    const contactEmail = form.contactEmail.trim();
    if (contactEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError(tc("errEmailInvalid"));
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
        throw new Error(data.error ?? t("errAddParticipant"));
      }
      setForm(INITIAL_FORM);
      // Server-rendered list refresh — picks up the new invite without a
      // full page reload.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errAddParticipant"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("fldName")} required hint={t("inviteNameHint")}>
          <input
            value={form.contactLabel}
            onChange={(e) => update("contactLabel", e.target.value)}
            placeholder={t("phContactName")}
            disabled={submitting}
            className={FIELD_INPUT_CLASS}
          />
        </Field>

        <Field label={t("fldEmail")} hint={t("inviteEmailHint")}>
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            placeholder={t("phContactEmail")}
            disabled={submitting}
            className={FIELD_INPUT_CLASS}
          />
        </Field>

        <Field label={t("fldMode")} hint={t("modeHint")}>
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
                {t(opt.labelKey)}
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
          {submitting ? t("inviteSubmitAdding") : t("addParticipant")}
        </Button>
        <span className="text-small text-neutral-500">
          {t("inviteSubmitHelp")}
        </span>
      </div>
    </form>
  );
}
