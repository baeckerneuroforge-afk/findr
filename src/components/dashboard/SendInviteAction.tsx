"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/**
 * Per-invite "Send" button. Etappe B Teil 2b.
 *
 * UI contract (mirrors the API's pre-checks so the user sees what's blocking
 * BEFORE they click, not after a 422):
 *
 *   scheduledAt missing  → button disabled, hint "Schedule first"
 *   contactEmail missing → button disabled, hint "Add an email"
 *   invitedAt set        → button hidden; replaced by "Sent" timestamp
 *   otherwise            → "Send invite" button is active
 *
 * On click: POST /api/research/invites/[id]/send → router.refresh() on
 * success so invited_at comes back populated and the row re-renders into
 * the "Sent" state. 502 / 409 / 422 / 404 errors are rendered visibly in
 * the cell (no silent failure — a missing mail without feedback is the
 * worst UX for this flow).
 */

interface SendInviteActionProps {
  inviteId: string;
  scheduledAt: string | null;
  invitedAt: string | null;
  /** "" when contact_email was null in DB (the service normalizes it). */
  contactEmail: string;
  /** Disable when the surrounding row is in a terminal state (completed,
   *  cancelled, no_show) or the plan is archived/completed. Parent decides. */
  disabled?: boolean;
}

function formatSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function SendInviteAction({
  inviteId,
  scheduledAt,
  invitedAt,
  contactEmail,
  disabled = false,
}: SendInviteActionProps) {
  const router = useRouter();
  const t = useTranslations("research.plans");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Already sent — terminal state, no button ─────────────────────────────
  if (invitedAt) {
    return (
      <div className="text-small text-success-700 whitespace-nowrap">
        {t("sentAt", { date: formatSentAt(invitedAt) })}
      </div>
    );
  }

  // ── Not ready — disabled with reason ─────────────────────────────────────
  // Order matches the API's pre-check order (schedule first, then email).
  // Both blockers shown inline so the user knows what to fix.
  let blockingHint: string | null = null;
  if (!scheduledAt) {
    blockingHint = t("scheduleFirst");
  } else if (contactEmail.trim() === "") {
    blockingHint = t("emailNeeded");
  }
  const buttonDisabled = disabled || blockingHint !== null || submitting;

  async function send() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/research/invites/${inviteId}/send`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sentTo?: string;
        invitedAt?: string;
      };
      if (!res.ok) {
        // 409 (already sent — race with another tab) collapses to the same
        // "ok, refresh and show terminal state" path: a re-render via
        // router.refresh() picks up the now-present invited_at.
        if (res.status === 409 && data.invitedAt) {
          router.refresh();
          return;
        }
        throw new Error(data.error ?? t("errSendInvite"));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errSendInvite"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        onClick={send}
        disabled={buttonDisabled}
      >
        {submitting ? t("sending") : t("sendInvite")}
      </Button>
      {blockingHint && (
        <div className="text-caption text-neutral-500">{blockingHint}</div>
      )}
      {error && (
        <div className="text-caption text-danger-700">{error}</div>
      )}
    </div>
  );
}
