"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

/**
 * Per-row "Löschen" button for the Participants table. Calls DELETE
 * /api/research/plans/[planId]/participants/[participantId], then
 * router.refresh so the server-rendered table loses the row.
 *
 * Guardrails:
 *  - window.confirm dialog with the participant's display label and a
 *    note that completed-session data stays (FK is ON DELETE SET NULL,
 *    so the interview transcript is preserved even after the invite is
 *    gone — see route.ts header for the rationale).
 *  - `disabled` mirrors what the surrounding row knows: archived plans
 *    lock all actions, so the delete-button gets locked too. Keeps the
 *    affordance honest about which rows are still mutable.
 *
 * Errors surface inline (text-danger-700) below the button — same posture
 * as SendInviteAction. No silent failures on a destructive action.
 */

interface DeleteParticipantButtonProps {
  planId: string;
  participantId: string;
  /** Used in the confirm-dialog so the user sees who they're about to
   *  remove ("Jane Doe, Acme" instead of a UUID). */
  contactLabel: string;
  /** Locked when the surrounding plan is archived (mirrors the gating
   *  of Schedule + Send buttons). */
  disabled?: boolean;
}

export function DeleteParticipantButton({
  planId,
  participantId,
  contactLabel,
  disabled = false,
}: DeleteParticipantButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    // Native confirm is intentional — accessible, no design system
    // dependency, and the destructive copy stays in one place. The
    // German copy explicitly mentions the preserved-session edge case
    // so the user isn't surprised later when they find an orphaned
    // session.
    const ok = window.confirm(
      `Teilnehmer „${contactLabel}" wirklich löschen?\n\n` +
        "Bereits geführte Interviews (Transkripte, Auswertung) bleiben " +
        "erhalten – nur die Verknüpfung zum Plan wird entfernt.",
    );
    if (!ok) return;

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/research/plans/${planId}/participants/${participantId}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Konnte den Teilnehmer nicht löschen.");
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Konnte den Teilnehmer nicht löschen.",
      );
      setSubmitting(false);
    }
    // No setSubmitting(false) on success — the row disappears after
    // router.refresh, so this component unmounts before the flag matters.
  }

  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={disabled || submitting}
        aria-label={`Teilnehmer ${contactLabel} löschen`}
        className="text-danger-700 hover:bg-danger-50"
      >
        {submitting ? "Lösche…" : "Löschen"}
      </Button>
      {error && (
        <div className="text-caption text-danger-700">{error}</div>
      )}
    </div>
  );
}
