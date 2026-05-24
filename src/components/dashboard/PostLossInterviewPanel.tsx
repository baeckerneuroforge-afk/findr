"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

interface SessionView {
  accessToken: string;
  status: "open" | "completed" | "abandoned";
  createdAt: string;
  completedAt: string | null;
}

interface PostLossInterviewPanelProps {
  dealId: string;
  hasContact: boolean;
  initialSession: SessionView | null;
}

const STATUS_META: Record<
  SessionView["status"],
  { label: string; variant: BadgeVariant }
> = {
  open: { label: "In progress", variant: "default" },
  completed: { label: "Completed", variant: "success" },
  abandoned: { label: "Abandoned", variant: "default" },
};

const INPUT_CLASS =
  "h-9 min-w-0 flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-body text-neutral-700 outline-none";

export function PostLossInterviewPanel({
  dealId,
  hasContact,
  initialSession,
}: PostLossInterviewPanelProps) {
  const [session, setSession] = useState<SessionView | null>(initialSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Build the absolute link only after mount (window is client-only); the first
  // render matches the server (origin = "") to avoid a hydration mismatch.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = session ? `${origin}/interview/${session.accessToken}` : "";

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/interview`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        session?: SessionView;
      };
      if (!res.ok || !data.session) {
        throw new Error(data.error ?? "Could not start the interview.");
      }
      setSession(data.session);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start the interview.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the link is selectable in the field as a
      // fallback.
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-h2 text-neutral-900">Post-Loss Interview</h2>
        <p className="mt-1 text-small text-neutral-500">
          A short, confidential chat that surfaces the real reason this deal was
          lost and checks it against the risk prediction.
        </p>
      </CardHeader>
      <CardBody>
        {session ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-body text-neutral-500">Status</span>
              <Badge variant={STATUS_META[session.status].variant}>
                {STATUS_META[session.status].label}
              </Badge>
            </div>
            <div>
              <span className="mb-1.5 block text-body-strong text-neutral-900">
                Interview link
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
              <p className="mt-2 text-small text-neutral-500">
                Nothing is sent automatically yet — share this link to run the
                interview. (Sending comes next.)
              </p>
            </div>
          </div>
        ) : !hasContact ? (
          <p className="text-body text-neutral-500">
            Add contact details to start an interview.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-body text-neutral-700">
              Generate a one-time interview link for the buyer contact.
            </p>
            {error && (
              <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
                {error}
              </div>
            )}
            <Button onClick={start} disabled={loading}>
              {loading ? "Starting…" : "Start interview"}
            </Button>
          </div>
        )}

        {session && error && (
          <div className="mt-3 rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
            {error}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
