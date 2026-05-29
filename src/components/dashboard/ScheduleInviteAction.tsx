"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";

/**
 * Per-invite "set / change date" action. Inline expansion (NOT modal) — a
 * "Set date" link in the table cell expands a small form below it with a
 * datetime-local input and Save/Cancel buttons. Submit fires POST to
 * /api/research/invites/[id]/schedule and router.refresh()'s so the
 * server-rendered table picks up the new scheduled_at + status.
 *
 * Etappe B Teil 2a — NO mail send. The "Schedule + send" combo (with
 * Resend + ICS) lands in Teil 2b. This action only writes the timestamp.
 *
 * UX note: datetime-local accepts "YYYY-MM-DDTHH:mm". We send that as-is;
 * the server parses with new Date(...) which uses the request's runtime
 * locale to interpret. For DACH-deployed Vercel this is OK — the user
 * thinks in their local time and the server stores ISO UTC after the
 * Date round-trip. If the editor ever spans multiple time zones we'd
 * append the offset client-side; today we don't.
 */

interface ScheduleInviteActionProps {
  inviteId: string;
  scheduledAt: string | null;
  /** Disable the action when the plan is no longer in a re-schedulable
   *  status (e.g. completed/archived). The parent decides; we just
   *  render disabled. */
  disabled?: boolean;
}

/** Convert an ISO string to the value shape a <input type="datetime-local">
 *  expects: "YYYY-MM-DDTHH:mm" in the BROWSER's local time. The native
 *  <input> already does the locale rendering; we just truncate to the
 *  minute and drop the TZ suffix. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Build YYYY-MM-DDTHH:mm in LOCAL time. getTimezoneOffset() returns
  // minutes EAST of UTC negated, so adding it brings d to "local-UTC" which
  // toISOString then renders as the local wall-clock.
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatScheduledForDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function ScheduleInviteAction({
  inviteId,
  scheduledAt,
  disabled = false,
}: ScheduleInviteActionProps) {
  const router = useRouter();
  const t = useTranslations("research.plans");
  const tc = useTranslations("research.common");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(isoToLocalInput(scheduledAt));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!value) {
      setError(t("errPickDate"));
      return;
    }
    const picked = new Date(value);
    if (Number.isNaN(picked.getTime())) {
      setError(t("errInvalidDate"));
      return;
    }
    if (picked.getTime() <= Date.now()) {
      setError(t("errFutureDate"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/research/invites/${inviteId}/schedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduledAt: picked.toISOString() }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? t("errSaveDate"));
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errSaveDate"));
    } finally {
      setSubmitting(false);
    }
  }

  // Closed state — show current date (or a "Set date" link) and an action.
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {scheduledAt ? (
          <span className="text-body text-neutral-700 whitespace-nowrap">
            {formatScheduledForDisplay(scheduledAt)}
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="text-caption text-primary-700 transition-colors hover:text-primary-900 disabled:opacity-50"
        >
          {scheduledAt ? t("change") : t("setDate")}
        </button>
      </div>
    );
  }

  // Open state — inline editor.
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={submitting}
          className={`${FIELD_INPUT_CLASS} max-w-[14rem]`}
        />
        <Button size="sm" onClick={save} disabled={submitting}>
          {submitting ? tc("saving") : tc("save")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
            setValue(isoToLocalInput(scheduledAt));
          }}
          disabled={submitting}
        >
          {tc("cancel")}
        </Button>
      </div>
      {error && (
        <div className="text-caption text-danger-700">{error}</div>
      )}
    </div>
  );
}
