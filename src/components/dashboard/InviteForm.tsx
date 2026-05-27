"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FIELD_INPUT_CLASS } from "@/components/ui/Field";

/**
 * Inline "+ Add participant" form for the plan-detail page (Etappe B Teil 1).
 * Mirrors ResearchPlanForm: client component, useState for form / submitting
 * / error, fetch POST to /api/research/plans/[id]/invites, then router.refresh
 * so the server-rendered invite list picks up the new row.
 *
 * Scope: invite ANLAGE only — no schedule, no mail. The status lands as
 * 'pending' (DB default via createResearchInvite). The "Schedule + send"
 * action per-invite is Etappe B Teil 2.
 *
 * The agent currently only handles the text mode end-to-end; voice and
 * video are accepted as the participant's preference and stored, but the
 * /interview/[token] page renders all three the same way today.
 */

type Mode = "text" | "voice" | "video";

const MODE_OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: "text", label: "Text chat" },
  { value: "voice", label: "Voice (preference — text fallback today)" },
  { value: "video", label: "Video (preference — text fallback today)" },
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
      setError("Contact label is required.");
      return;
    }

    // Email is optional, but if given, do a quick client-side shape check so
    // the user doesn't see the API's generic Zod error.
    const contactEmail = form.contactEmail.trim();
    if (contactEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError("Contact email doesn't look valid.");
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
        throw new Error(data.error ?? "Could not add the participant.");
      }
      setForm(INITIAL_FORM);
      // Server-rendered list refresh — picks up the new invite without a
      // full page reload.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not add the participant.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Contact label"
          required
          hint="Shown in the participant list. A name or 'Name, Company' works."
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
          label="Contact email"
          hint="Optional today — required when scheduling + sending in part 2."
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
          label="Mode preference"
          hint="Stored as the participant's wish — only text is wired today."
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
          {submitting ? "Adding..." : "Add participant"}
        </Button>
        <span className="text-small text-neutral-500">
          Stored as pending — schedule + send the invite in the next step.
        </span>
      </div>
    </form>
  );
}
