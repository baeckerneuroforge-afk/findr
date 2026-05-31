"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ScreeningQuestion } from "@/lib/schemas/screening";
import { ParticipantShell } from "./ParticipantShell";
import { ScreeningForm } from "./ScreeningForm";
import { RejectionPanel } from "./RejectionPanel";

/**
 * Participant screening gate (Etappe 4 — WIRED).
 *
 * Rendered by the page ONLY in needs_screening mode (research invite, screening
 * configured, no session yet — the session was DEFERRED server-side). Shows the
 * form; on submit it POSTs to /api/interview/[token]/screen, which runs the
 * deterministic evaluateScreening:
 *   - qualified → the session was just created server-side → router.refresh()
 *     re-renders the page into session mode → the interview appears.
 *   - rejected  → render the RejectionPanel (no session, no Opus turn).
 * Re-try is allowed: RejectionPanel → back to the form → fresh submit.
 *
 * Session mode (the interview itself) is NOT handled here — once a session
 * exists, the page renders InterviewChat directly.
 */

type AnswerMap = Record<string, string | string[] | number>;

export function ScreeningGate({
  token,
  questions,
  brandName = null,
  accentColor = null,
  logoUrl = null,
  planTitle = null,
}: {
  token: string;
  questions: ScreeningQuestion[];
  brandName?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  planTitle?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("interview");
  const [step, setStep] = useState<"screening" | "rejected">("screening");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete(answers: AnswerMap) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/interview/${token}/screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        qualified?: boolean;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? t("error.generic"));
      }
      if (data.qualified) {
        // Session was created server-side — re-render into session mode so the
        // interview appears. Keep submitting=true; the gate unmounts on refresh.
        router.refresh();
        return;
      }
      setStep("rejected");
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.generic"));
      setSubmitting(false);
    }
  }

  return (
    <ParticipantShell
      brandless
      brandName={brandName}
      accentColor={accentColor}
      logoUrl={logoUrl}
    >
      {step === "screening" ? (
        <ScreeningForm
          questions={questions}
          planTitle={planTitle}
          submitting={submitting}
          error={error}
          onComplete={handleComplete}
        />
      ) : (
        <RejectionPanel
          onRetry={() => {
            setError(null);
            setStep("screening");
          }}
        />
      )}
    </ParticipantShell>
  );
}
