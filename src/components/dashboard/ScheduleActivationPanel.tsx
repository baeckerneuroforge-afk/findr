"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import {
  formatActivationDateTime,
  isoToLocalInput,
} from "@/lib/scheduler/datetime";

/**
 * Deferred Activation control on the study detail page (Phase 1, manual).
 *
 * A draft study can be SCHEDULED for a future activation time (overview only —
 * no cron yet) and RELEASED now via "Jetzt aktivieren", which flips it live and
 * sends the prepared pool invites. The invite-release summary comes back in the
 * response and is surfaced as a toast ("live · 23 versendet · 2 brauchen einen
 * Termin"). For non-draft studies this renders a compact read-only state.
 *
 * Mirrors PlanStatusControl (PATCH + router.refresh + inline error) and
 * ScheduleInviteAction (datetime-local + isoToLocalInput). Prolific publishing is
 * never touched here.
 */

type Status = "draft" | "active" | "completed" | "archived";
type ActivationState =
  | "none"
  | "scheduled"
  | "activating"
  | "activated"
  | "failed";

interface ScheduleActivationPanelProps {
  planId: string;
  status: Status;
  activationState: ActivationState;
  scheduledActivationAt: string | null;
  activatedAt: string | null;
}

interface InviteReleaseSummary {
  total: number;
  sent: number;
  needsSchedule: number;
  needsContact: number;
  failed: number;
}

const STATE_VARIANT: Record<ActivationState, BadgeVariant> = {
  none: "default",
  scheduled: "medium",
  activating: "high",
  activated: "success",
  failed: "critical",
};

export function ScheduleActivationPanel({
  planId,
  status,
  activationState,
  scheduledActivationAt,
  activatedAt,
}: ScheduleActivationPanelProps) {
  const router = useRouter();
  const t = useTranslations("kalender");
  const locale = useLocale();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(isoToLocalInput(scheduledActivationAt));
  const [busy, setBusy] = useState<"schedule" | "cancel" | "activate" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const isDraft = status === "draft";
  const isScheduled = activationState === "scheduled" && !!scheduledActivationAt;

  function buildReleaseToast(summary: InviteReleaseSummary | undefined): string {
    const base = t("toastActivatedLive");
    if (!summary || summary.total === 0) return base;
    const parts: string[] = [];
    if (summary.sent > 0) parts.push(t("releaseSent", { count: summary.sent }));
    if (summary.needsSchedule > 0)
      parts.push(t("releaseNeedsSchedule", { count: summary.needsSchedule }));
    if (summary.needsContact > 0)
      parts.push(t("releaseNeedsContact", { count: summary.needsContact }));
    if (summary.failed > 0)
      parts.push(t("releaseFailed", { count: summary.failed }));
    return parts.length > 0 ? `${base} ${parts.join(" · ")}` : base;
  }

  async function saveSchedule() {
    setError(null);
    if (!value) {
      setError(t("errPickDate"));
      return;
    }
    const picked = new Date(value);
    if (Number.isNaN(picked.getTime())) {
      setError(t("errPickDate"));
      return;
    }
    if (picked.getTime() <= Date.now()) {
      setError(t("errFutureDate"));
      return;
    }
    setBusy("schedule");
    try {
      const res = await fetch(`/api/research/plans/${planId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledActivationAt: picked.toISOString() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("errSaveSchedule"));
      setEditing(false);
      toast(t("toastScheduled"), "success");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errSaveSchedule"));
    } finally {
      setBusy(null);
    }
  }

  async function cancelSchedule() {
    setError(null);
    setBusy("cancel");
    try {
      const res = await fetch(`/api/research/plans/${planId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledActivationAt: null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("errSaveSchedule"));
      toast(t("toastCancelled"), "info");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errSaveSchedule"));
    } finally {
      setBusy(null);
    }
  }

  async function activateNow() {
    setError(null);
    setBusy("activate");
    try {
      const res = await fetch(`/api/research/plans/${planId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        invites?: InviteReleaseSummary;
      };
      if (!res.ok) throw new Error(data.error ?? t("errActivate"));
      toast(buildReleaseToast(data.invites), "success");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errActivate"));
    } finally {
      setBusy(null);
    }
  }

  // ── non-draft: compact read-only state ──
  if (!isDraft) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant={STATE_VARIANT[activationState]}>
            {t(`state.${activationState}`)}
          </Badge>
          {status === "active" && activatedAt && (
            <span className="text-small text-neutral-500">
              {t("liveSince", {
                when: formatActivationDateTime(activatedAt, locale),
              })}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── draft: full scheduling UI ──
  // A draft is coherently only "scheduled" or "none". A stale terminal state
  // (e.g. 'activated' carried over after a reactivation archived→draft) is
  // normalised here so a reactivated draft reads as unscheduled, not "Aktiviert".
  const draftState = isScheduled ? "scheduled" : "none";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATE_VARIANT[draftState]}>{t(`state.${draftState}`)}</Badge>
        {isScheduled && !editing && (
          <span className="text-small text-neutral-600">
            {t("scheduledForLabel", {
              when: formatActivationDateTime(scheduledActivationAt!, locale),
            })}
          </span>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <label className="block text-small text-neutral-600" htmlFor="act-at">
            {t("pickTimeLabel")}
            <span className="ml-2 text-caption text-neutral-400">
              {t("tzNote")}
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="act-at"
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy !== null}
              className={`${FIELD_INPUT_CLASS} max-w-[16rem]`}
            />
            <Button
              size="sm"
              onClick={saveSchedule}
              disabled={busy !== null}
            >
              {busy === "schedule" ? t("saving") : t("saveSchedule")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setError(null);
                setValue(isoToLocalInput(scheduledActivationAt));
              }}
              disabled={busy !== null}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={activateNow}
            disabled={busy !== null}
          >
            {busy === "activate" ? t("activating") : t("activateNow")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setEditing(true)}
            disabled={busy !== null}
          >
            {isScheduled ? t("changeSchedule") : t("setSchedule")}
          </Button>
          {isScheduled && (
            <Button
              variant="ghost"
              onClick={cancelSchedule}
              disabled={busy !== null}
            >
              {busy === "cancel" ? t("saving") : t("cancelSchedule")}
            </Button>
          )}
        </div>
      )}

      <p className="text-caption text-neutral-500">{t("releaseHint")}</p>

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}
    </div>
  );
}
