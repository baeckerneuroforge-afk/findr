"use client";

import { useEffect, useState } from "react";
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
}

const STATUS_META: Record<
  CheckinView["status"],
  { label: string; variant: BadgeVariant }
> = {
  open: { label: "Awaiting response", variant: "default" },
  completed: { label: "Completed", variant: "success" },
  abandoned: { label: "Abandoned", variant: "default" },
};

const INPUT_CLASS =
  "h-9 min-w-0 flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-body text-neutral-700 outline-none";

export function AccountCheckinPanel({
  accountId,
  sponsorEmail,
  initialCheckin,
}: AccountCheckinPanelProps) {
  const [checkin, setCheckin] = useState<CheckinView | null>(initialCheckin);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        throw new Error(data.error ?? "Could not send the check-in.");
      }
      setCheckin({
        accessToken: data.accessToken,
        status: "open",
        createdAt: new Date().toISOString(),
        completedAt: null,
        invitedAt: data.invitedAt ?? new Date().toISOString(),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send the check-in.",
      );
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

  return (
    <Card>
      <CardHeader>
        <h2 className="text-h2 text-neutral-900">Customer check-in</h2>
        <p className="mt-1 text-small text-neutral-500">
          A short AI check-in with the sponsor (satisfaction, blockers, usage).
          Their reply becomes a data point in the health score above.
        </p>
      </CardHeader>
      <CardBody>
        {!sponsorEmail ? (
          <p className="text-body text-neutral-500">
            Add a sponsor email in Account details to send a check-in.
          </p>
        ) : checkin ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-body text-neutral-500">Status</span>
              <Badge variant={STATUS_META[checkin.status].variant}>
                {STATUS_META[checkin.status].label}
              </Badge>
            </div>

            {checkin.status === "completed" ? (
              <p className="text-small text-success-700">
                Completed — the response was added to the health score above.
              </p>
            ) : (
              <p className="text-small text-neutral-500">
                {checkin.invitedAt
                  ? `Invitation sent to ${sponsorEmail} · ${checkin.invitedAt.slice(0, 10)}`
                  : "Awaiting the sponsor's response."}
              </p>
            )}

            <div>
              <span className="mb-1.5 block text-body-strong text-neutral-900">
                Check-in link
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className={INPUT_CLASS}
                />
                <Button variant="secondary" onClick={copy}>
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <a href={link} target="_blank" rel="noreferrer">
                  <Button variant="ghost">Open</Button>
                </a>
              </div>
            </div>

            {checkin.status === "open" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={send} disabled={sending}>
                  {sending
                    ? "Sending…"
                    : checkin.invitedAt
                      ? "Resend invitation"
                      : "Send invitation"}
                </Button>
                <span className="text-small text-neutral-500">
                  to {sponsorEmail}
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
              Send a short check-in to {sponsorEmail}. We email a one-time link;
              the sponsor&apos;s answers become a health-score data point.
            </p>
            {error && (
              <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
                {error}
              </div>
            )}
            <Button onClick={send} disabled={sending}>
              {sending ? "Sending…" : "Send check-in"}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default AccountCheckinPanel;
