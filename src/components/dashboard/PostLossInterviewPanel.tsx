"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EvidenceQuote } from "@/components/dashboard/EvidenceQuote";
import type { InterviewTurn } from "@/lib/voice-agent/interviewer";

type MatchPrediction = "yes" | "no" | "partial";

interface SessionView {
  accessToken: string;
  status: "open" | "completed" | "abandoned";
  createdAt: string;
  completedAt: string | null;
  invitedAt?: string | null;
  // Result fields — only present once the interview is completed.
  extractedReason?: string | null;
  evidence?: string | null;
  matchedRiskPrediction?: MatchPrediction | null;
  reasoning?: string | null;
  conversation?: InterviewTurn[];
}

interface PostLossInterviewPanelProps {
  dealId: string;
  hasContact: boolean;
  contactEmail: string | null;
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

// Human-readable labels for the loss-reason categories (the enum values stored
// in extracted_reason). UI stays English; quotes/conversation keep their
// original language.
const LOSS_REASON_LABELS: Record<string, string> = {
  pricing: "Pricing",
  budget: "Budget",
  competitor: "Competitor",
  feature_gap: "Feature Gap",
  compliance: "Compliance",
  timing: "Timing",
  champion_lost: "Champion Loss",
  no_decision: "No Decision",
  internal_priority: "Internal Priority",
  other: "Other",
};

function lossReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Unknown";
  return (
    LOSS_REASON_LABELS[reason] ??
    reason
      .split("_")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ")
  );
}

function matchHeaderStyle(m: MatchPrediction): string {
  if (m === "yes") return "bg-success-50 border-success-500/30";
  if (m === "no") return "bg-danger-50 border-danger-500/30";
  return "bg-warning-50 border-warning-500/30";
}

function matchBadgeStyle(m: MatchPrediction): string {
  if (m === "yes") return "border-success-500/30 bg-success-50 text-success-700";
  if (m === "no") return "border-danger-500 bg-danger-500 text-white";
  return "border-warning-500/30 bg-warning-50 text-warning-700";
}

function matchBadgeLabel(m: MatchPrediction): string {
  if (m === "yes") return "Yes";
  if (m === "no") return "No";
  return "Partially";
}

function matchStatement(m: MatchPrediction): string {
  if (m === "yes")
    return "Findr's risk analysis predicted the real reason this deal was lost.";
  if (m === "no")
    return "The real reason differed from what Findr's risk analysis predicted.";
  return "Findr's risk analysis caught part of the real reason, but not all of it.";
}

const INPUT_CLASS =
  "h-9 min-w-0 flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-body text-neutral-700 outline-none";

function CompletedResult({ session }: { session: SessionView }) {
  const [showConversation, setShowConversation] = useState(false);
  const mp = session.matchedRiskPrediction ?? null;
  const conversation = session.conversation ?? [];

  return (
    <div className="space-y-5">
      {/* Risk-prediction match — the ground truth: was the AI right? */}
      {mp && (
        <div className={`rounded-lg border p-5 ${matchHeaderStyle(mp)}`}>
          <div className="mb-2 text-caption uppercase tracking-wider text-neutral-500">
            Did Findr&apos;s risk analysis call it?
          </div>
          <span
            className={`inline-block rounded-md border px-2 py-0.5 text-caption font-semibold uppercase ${matchBadgeStyle(mp)}`}
          >
            {matchBadgeLabel(mp)}
          </span>
          <p className="mt-3 text-body leading-relaxed text-neutral-700">
            {session.reasoning?.trim() ? session.reasoning : matchStatement(mp)}
          </p>
        </div>
      )}

      {/* Extracted real loss reason */}
      <div>
        <div className="mb-1.5 text-caption uppercase tracking-wider text-neutral-500">
          Real loss reason
        </div>
        <div className="text-h2 text-neutral-900">
          {lossReasonLabel(session.extractedReason)}
        </div>
      </div>

      {/* Evidence quote (kept in its original language) */}
      {session.evidence?.trim() && (
        <div>
          <div className="mb-1.5 text-caption uppercase tracking-wider text-neutral-500">
            In the buyer&apos;s words
          </div>
          <EvidenceQuote quote={session.evidence} speakerRole="buyer" />
        </div>
      )}

      {/* Full conversation — collapsed by default, like the call transcript */}
      {conversation.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowConversation((v) => !v)}
            className="rounded-md px-2.5 py-1 text-caption font-medium text-primary-700 transition-colors hover:bg-primary-50"
          >
            {showConversation ? "Hide conversation" : "Show conversation"}
          </button>
          {showConversation && (
            <div className="mt-2 max-h-[500px] space-y-3 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              {conversation.map((turn, i) => (
                <div key={i}>
                  <div className="mb-0.5 text-caption font-medium text-neutral-500">
                    {turn.role === "agent" ? "Findr" : "Buyer"}
                  </div>
                  <p className="whitespace-pre-wrap text-body leading-relaxed text-neutral-700">
                    {turn.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PostLossInterviewPanel({
  dealId,
  hasContact,
  contactEmail,
  initialSession,
}: PostLossInterviewPanelProps) {
  const [session, setSession] = useState<SessionView | null>(initialSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [invitedAt, setInvitedAt] = useState<string | null>(
    initialSession?.invitedAt ?? null,
  );
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

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

  async function sendInvite() {
    setSending(true);
    setInviteError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/interview/invite`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        invitedAt?: string | null;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not send the invitation.");
      }
      setInvitedAt(data.invitedAt ?? new Date().toISOString());
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Could not send the invitation.",
      );
    } finally {
      setSending(false);
    }
  }

  const isCompleted = session?.status === "completed";

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
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="text-body text-neutral-500">Status</span>
              <Badge variant={STATUS_META[session.status].variant}>
                {STATUS_META[session.status].label}
              </Badge>
              {isCompleted && (
                <a
                  href={`/api/deals/${dealId}/interview/pdf`}
                  className="ml-auto"
                >
                  <Button variant="secondary" size="sm">
                    Export PDF
                  </Button>
                </a>
              )}
            </div>

            {isCompleted && <CompletedResult session={session} />}

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
              {!isCompleted && (
                <p className="mt-2 text-small text-neutral-500">
                  Or copy the link to share it manually.
                </p>
              )}
            </div>

            {session.status === "open" && (
              <div className="border-t border-neutral-100 pt-4">
                <span className="mb-1.5 block text-body-strong text-neutral-900">
                  Email invitation
                </span>
                {!contactEmail ? (
                  <p className="text-small text-neutral-500">
                    Add a contact email to send the invitation.
                  </p>
                ) : invitedAt ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-small text-success-700">
                      Invitation sent to {contactEmail} · {invitedAt.slice(0, 10)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={sendInvite}
                      disabled={sending}
                    >
                      {sending ? "Sending…" : "Resend"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={sendInvite} disabled={sending}>
                      {sending ? "Sending…" : "Send invitation"}
                    </Button>
                    <span className="text-small text-neutral-500">
                      to {contactEmail}
                    </span>
                  </div>
                )}
                {inviteError && (
                  <div className="mt-2 rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
                    {inviteError}
                  </div>
                )}
              </div>
            )}
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
