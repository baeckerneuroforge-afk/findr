"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FIELD_INPUT_CLASS } from "@/components/ui/Field";

/**
 * Per-row "Bearbeiten" button for the Participants table. Toggles a small
 * inline modal-style overlay carrying the existing label + email and
 * sends a PATCH to /api/research/plans/[planId]/participants/[participantId]
 * on save, then router.refresh so the server-rendered row picks up the
 * new values.
 *
 * Style mirrors DeleteParticipantButton: ghost-variant trigger, native
 * confirm-style copy, no design-system modal dependency. The "modal" is a
 * fixed-positioned panel with a backdrop — accessible (ESC closes, click
 * outside closes, focus restores) without pulling in a dialog library and
 * without portal gymnastics, since this component is already a leaf in
 * the server-rendered table.
 *
 * Field rules mirror the POST /invites schema:
 *  - contactLabel: required, trimmed, 1..200 chars
 *  - contactEmail: optional; if non-empty, must match the same client-side
 *    shape check as InviteForm (the server is the source of truth, this
 *    is just to avoid a roundtrip on obviously-bad input)
 *
 * The server enforces dedup against existing emails in the same plan and
 * returns 409 with a German message — we surface that text inline.
 */

interface EditParticipantButtonProps {
  planId: string;
  participantId: string;
  /** Current values prefilled into the form. The participant's row in the
   *  table already shows these — we hand them in directly instead of
   *  re-fetching, since the server-rendered row is the source of truth. */
  initialLabel: string;
  initialEmail: string | null;
  /** Locked when the surrounding plan is archived — same gating as
   *  DeleteParticipantButton (`plan.status === "archived"`). Editing a
   *  closed plan would be confusing and possibly affect already-sent
   *  invites in surprising ways, so we just freeze it. */
  disabled?: boolean;
}

export function EditParticipantButton({
  planId,
  participantId,
  initialLabel,
  initialEmail,
  disabled = false,
}: EditParticipantButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(initialLabel);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelInputRef = useRef<HTMLInputElement | null>(null);

  // ESC to close — same posture as a native <dialog>. We don't add a
  // global click-outside since the backdrop already swallows clicks; the
  // ESC binding is the only extra a11y nicety we need.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    // Autofocus the first input when the panel opens.
    labelInputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting]);

  function handleOpen() {
    // Re-prime the form from props each time we open — covers the case
    // where the user edited, cancelled, and re-opens: they should see the
    // committed values, not the abandoned draft.
    setLabel(initialLabel);
    setEmail(initialEmail ?? "");
    setError(null);
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedLabel = label.trim();
    if (trimmedLabel.length === 0) {
      setError("Name ist erforderlich.");
      return;
    }
    if (trimmedLabel.length > 200) {
      setError("Name ist zu lang (max. 200 Zeichen).");
      return;
    }
    const trimmedEmail = email.trim();
    if (
      trimmedEmail !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    ) {
      setError("Die E-Mail-Adresse sieht nicht gültig aus.");
      return;
    }

    // No-op short-circuit: don't bother the server if nothing actually
    // changed. Reduces noise and avoids a 200-but-meaningless roundtrip.
    const normalizedInitialEmail = initialEmail ?? "";
    if (
      trimmedLabel === initialLabel &&
      trimmedEmail === normalizedInitialEmail
    ) {
      setOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/research/plans/${planId}/participants/${participantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // Send both fields — server treats undefined-vs-null carefully
          // for `contactEmail` (null clears, string sets, omit keeps). We
          // always send both because we always show both in the form.
          body: JSON.stringify({
            contactLabel: trimmedLabel,
            contactEmail: trimmedEmail === "" ? null : trimmedEmail,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Konnte den Teilnehmer nicht speichern.");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Konnte den Teilnehmer nicht speichern.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        disabled={disabled || submitting}
        aria-label={`Teilnehmer ${initialLabel} bearbeiten`}
      >
        Bearbeiten
      </Button>

      {open && (
        <div
          // Backdrop: fixed full-viewport. Click-outside-to-close is
          // implemented by attaching onMouseDown to the backdrop itself —
          // clicks on the inner panel (stopPropagation) don't trigger it.
          // Submitting locks closing so a half-saved edit doesn't vanish
          // mid-flight.
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Teilnehmer bearbeiten"
          onMouseDown={() => {
            if (!submitting) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-h4 mb-1 text-neutral-900">
              Teilnehmer bearbeiten
            </h3>
            <p className="mb-4 text-small text-neutral-500">
              Änderungen werden sofort gespeichert. Bereits versendete
              Einladungen bleiben unverändert.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Name" required>
                <input
                  ref={labelInputRef}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Jane Doe, Acme"
                  disabled={submitting}
                  maxLength={200}
                  className={FIELD_INPUT_CLASS}
                />
              </Field>

              <Field
                label="E-Mail"
                hint="Optional. Leer lassen, um die E-Mail zu entfernen."
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@acme.example"
                  disabled={submitting}
                  maxLength={320}
                  className={FIELD_INPUT_CLASS}
                />
              </Field>

              {error && (
                <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  Abbrechen
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? "Speichere…" : "Speichern"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
