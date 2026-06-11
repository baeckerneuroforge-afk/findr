"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";

/**
 * Per-row participant actions for the Participants table: "Löschen"
 * (remove from list, keep the interview as a research artifact) and
 * "Daten löschen" (GDPR erasure — also wipes the transcript/analysis via
 * DELETE …?erase=true). Both confirm, call the participant endpoint, then
 * router.refresh so the server-rendered table loses the row.
 *
 * Guardrails:
 *  - window.confirm dialog with the participant's display label. The
 *    remove copy notes the session is preserved (FK ON DELETE SET NULL);
 *    the erase copy warns the deletion is irreversible.
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
  const t = useTranslations("research.plans");
  const tc = useTranslations("research.common");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared handler for both actions. `erase` selects GDPR erasure
  // (?erase=true, also wipes the interview sessions) vs. the default
  // remove-from-list. Native confirm is intentional — accessible, no
  // design-system dependency, destructive copy in one place.
  async function runDelete(erase: boolean) {
    const ok = window.confirm(
      erase
        ? t("confirmEraseData", { name: contactLabel })
        : t("confirmDelete", { name: contactLabel }),
    );
    if (!ok) return;

    const errKey = erase ? "errEraseParticipant" : "errDeleteParticipant";
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/research/plans/${planId}/participants/${participantId}${
          erase ? "?erase=true" : ""
        }`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? t(errKey));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(errKey));
      setSubmitting(false);
    }
    // No setSubmitting(false) on success — the row disappears after
    // router.refresh, so this component unmounts before the flag matters.
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => runDelete(false)}
          disabled={disabled || submitting}
          aria-label={t("deleteAria", { name: contactLabel })}
          className="text-danger-700 hover:bg-danger-50"
        >
          {submitting ? tc("deleting") : tc("deleteLabel")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => runDelete(true)}
          disabled={disabled || submitting}
          aria-label={t("eraseDataAria", { name: contactLabel })}
          className="text-danger-700 hover:bg-danger-50"
        >
          {tc("eraseDataLabel")}
        </Button>
      </div>
      {error && (
        <div className="text-caption text-danger-700">{error}</div>
      )}
    </div>
  );
}
