"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toBcp47 } from "@/i18n/locale";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

interface CheckinView {
  accessToken: string;
  status: "open" | "completed" | "abandoned";
  createdAt: string;
  completedAt: string | null;
  invitedAt: string | null;
}

interface AccountCheckinPanelProps {
  accountId: string;
  sponsorEmail: string | null;
  initialCheckin: CheckinView | null;
  // Auto-schedule (Etappe B)
  initialEnabled: boolean;
  initialIntervalDays: number | null;
  lastCheckinAt: string | null;
}

// Check-in workflow status is chrome (a presentational state label, not
// analysis taxonomy) — translated via labelKey; only the variant comes from here.
const STATUS_META: Record<
  CheckinView["status"],
  { labelKey: string; variant: BadgeVariant }
> = {
  open: { labelKey: "checkinStatusOpen", variant: "default" },
  completed: { labelKey: "checkinStatusCompleted", variant: "success" },
  abandoned: { labelKey: "checkinStatusAbandoned", variant: "default" },
};

const INPUT_CLASS =
  "h-9 min-w-0 flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-body text-neutral-700 outline-none";

function formatDay(date: string, locale: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function nextDue(
  lastCheckinAt: string | null,
  intervalDays: number,
  atRunLabel: string,
  locale: string,
): string {
  if (!lastCheckinAt) return atRunLabel;
  const due = new Date(
    new Date(lastCheckinAt).getTime() + intervalDays * 24 * 60 * 60 * 1000,
  );
  return formatDay(due.toISOString(), locale);
}

export function AccountCheckinPanel({
  accountId,
  sponsorEmail,
  initialCheckin,
  initialEnabled,
  initialIntervalDays,
  lastCheckinAt,
}: AccountCheckinPanelProps) {
  const t = useTranslations("health.detail");
  const tc = useTranslations("health.common");
  const locale = useLocale();
  const [checkin, setCheckin] = useState<CheckinView | null>(initialCheckin);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-schedule state: editing values + the last-saved values (for display).
  const [enabled, setEnabled] = useState(initialEnabled);
  const [intervalInput, setIntervalInput] = useState(
    initialIntervalDays !== null ? String(initialIntervalDays) : "30",
  );
  const [saved, setSaved] = useState<{
    enabled: boolean;
    intervalDays: number | null;
  }>({ enabled: initialEnabled, intervalDays: initialIntervalDays });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  // Absolute link only after mount (window is client-only) to avoid hydration
  // mismatch.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = checkin ? `${origin}/interview/${checkin.accessToken}` : "";

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/checkin`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        accessToken?: string;
        invitedAt?: string | null;
      };
      if (!res.ok || !data.accessToken) {
        throw new Error(data.error ?? t("errSendCheckin"));
      }
      setCheckin({
        accessToken: data.accessToken,
        status: "open",
        createdAt: new Date().toISOString(),
        completedAt: null,
        invitedAt: data.invitedAt ?? new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errSendCheckin"));
    } finally {
      setSending(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the link is selectable in the field.
    }
  }

  async function saveSettings() {
    const n = Number(intervalInput);
    const validInterval = Number.isInteger(n) && n >= 1 && n <= 365;
    if (enabled && !validInterval) {
      setSettingsMsg(t("errInterval"));
      return;
    }
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkinEnabled: enabled,
          checkinIntervalDays: validInterval ? n : null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? t("errSaveSchedule"));
      }
      setSaved({ enabled, intervalDays: validInterval ? n : null });
      setSettingsMsg(t("savedMsg"));
    } catch (err) {
      setSettingsMsg(
        err instanceof Error ? err.message : t("errSaveSchedule"),
      );
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-h2 text-neutral-900">{t("checkinTitle")}</h2>
        <p className="mt-1 text-small text-neutral-500">
          {t("checkinSubtitle")}
        </p>
      </CardHeader>
      <CardBody>
        {!sponsorEmail ? (
          <p className="text-body text-neutral-500">{t("checkinNoSponsor")}</p>
        ) : (
          <div className="space-y-6">
            {/* ── Manual send ─────────────────────────────────────────────── */}
            {checkin ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-body text-neutral-500">
                    {t("checkinStatusLabel")}
                  </span>
                  <Badge variant={STATUS_META[checkin.status].variant}>
                    {t(STATUS_META[checkin.status].labelKey)}
                  </Badge>
                </div>

                {checkin.status === "completed" ? (
                  <p className="text-small text-success-700">
                    {t("checkinCompletedNote")}
                  </p>
                ) : (
                  <p className="text-small text-neutral-500">
                    {checkin.invitedAt
                      ? t("checkinInvitationSent", {
                          email: sponsorEmail,
                          date: checkin.invitedAt.slice(0, 10),
                        })
                      : t("checkinAwaiting")}
                  </p>
                )}

                <div>
                  <span className="mb-1.5 block text-body-strong text-neutral-900">
                    {t("checkinLink")}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      readOnly
                      value={link}
                      onFocus={(e) => e.currentTarget.select()}
                      className={INPUT_CLASS}
                    />
                    <Button variant="secondary" onClick={copy}>
                      {copied ? t("copied") : t("copyLink")}
                    </Button>
                    <a href={link} target="_blank" rel="noreferrer">
                      <Button variant="ghost">{t("openLink")}</Button>
                    </a>
                  </div>
                </div>

                {checkin.status === "open" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={send} disabled={sending}>
                      {sending
                        ? t("sending")
                        : checkin.invitedAt
                          ? t("resendInvitation")
                          : t("sendInvitation")}
                    </Button>
                    <span className="text-small text-neutral-500">
                      {t("toEmail", { email: sponsorEmail })}
                    </span>
                  </div>
                )}

                {error && (
                  <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-body text-neutral-700">
                  {t("checkinSendIntro", { email: sponsorEmail })}
                </p>
                {error && (
                  <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
                    {error}
                  </div>
                )}
                <Button onClick={send} disabled={sending}>
                  {sending ? t("sending") : t("sendCheckin")}
                </Button>
              </div>
            )}

            {/* ── Automatic schedule (Etappe B) ───────────────────────────── */}
            <div className="border-t border-neutral-100 pt-5">
              <span className="block text-body-strong text-neutral-900">
                {t("autoTitle")}
              </span>
              <p className="mt-0.5 mb-3 text-small text-neutral-500">
                {t("autoSubtitle", { email: sponsorEmail })}
              </p>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  disabled={savingSettings}
                  className="mt-1 accent-primary-500"
                />
                <span>
                  <span className="block text-body text-neutral-900">
                    {t("autoToggle")}
                  </span>
                  <span className="block text-caption text-neutral-500">
                    {t("autoToggleHint")}
                  </span>
                </span>
              </label>

              {enabled && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-small text-neutral-500">
                    {t("every")}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={intervalInput}
                    onChange={(e) => setIntervalInput(e.target.value)}
                    disabled={savingSettings}
                    className="h-9 w-20 rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none focus:border-primary-500"
                  />
                  <span className="text-small text-neutral-500">
                    {t("days")}
                  </span>
                  {[30, 60, 90].map((d) => (
                    <Button
                      key={d}
                      variant="ghost"
                      size="sm"
                      onClick={() => setIntervalInput(String(d))}
                      disabled={savingSettings}
                    >
                      {d}
                    </Button>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? tc("saving") : t("saveSchedule")}
                </Button>
                {settingsMsg && (
                  <span className="text-small text-neutral-500">
                    {settingsMsg}
                  </span>
                )}
              </div>

              <p className="mt-2 text-small text-neutral-600">
                {saved.enabled && saved.intervalDays
                  ? t("autoOnSummary", {
                      days: saved.intervalDays,
                      date: nextDue(
                        lastCheckinAt,
                        saved.intervalDays,
                        t("nextDueAtRun"),
                        locale,
                      ),
                    })
                  : t("autoOffSummary")}
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default AccountCheckinPanel;
