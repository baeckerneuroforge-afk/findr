"use client";

import { useState } from "react";
import type { InterviewTurn } from "@/lib/voice-agent/interviewer";
import type { ScreeningQuestion } from "@/lib/schemas/screening";
import { InterviewChat } from "./InterviewChat";
import { ParticipantShell } from "./ParticipantShell";
import { ScreeningForm } from "./ScreeningForm";
import { RejectionPanel } from "./RejectionPanel";

/**
 * Step-router between the page and InterviewChat (Etappe 3 — RENDER ONLY).
 *
 * Renders one of: ScreeningForm → RejectionPanel → InterviewChat. Branding
 * props are passed straight through, so `--brand-accent` and the logo/name
 * apply to all three screens identically.
 *
 * E3 boundary: this only chooses WHAT renders. It does NOT suppress the
 * session (getPublicSession already lazy-created it server-side), does NOT call
 * evaluateScreening, and does NOT touch the entry path. The ScreeningForm's
 * submit is a local stub that advances to the interview. E4 turns this into the
 * real gate: defer session creation, run evaluateScreening on submit, branch to
 * interview vs rejection, and write the anonymous research_screening_responses
 * quote row.
 */

export type ParticipantStep = "screening" | "rejected" | "interview";

interface ScreeningGateProps {
  token: string;
  initialConversation: InterviewTurn[];
  initialStatus: "open" | "completed" | "abandoned";
  company: string | null;
  brandless: boolean;
  headingOverride: string | null;
  brandName: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  screeningQuestions: ScreeningQuestion[];
  /** E3-only visual-QA override (?screening=questions|rejected|interview).
   *  Forces a specific screen so a Vercel preview can show each one without a
   *  real evaluation. E4 removes this — the real gate decides the step. */
  previewStep?: ParticipantStep | null;
}

export function ScreeningGate({
  token,
  initialConversation,
  initialStatus,
  company,
  brandless,
  headingOverride,
  brandName,
  accentColor,
  logoUrl,
  screeningQuestions,
  previewStep = null,
}: ScreeningGateProps) {
  // Render path: screening form when questions are configured, else straight to
  // the interview (today's behavior). Preview override wins for QA.
  const initialStep: ParticipantStep =
    previewStep ?? (screeningQuestions.length > 0 ? "screening" : "interview");
  const [step, setStep] = useState<ParticipantStep>(initialStep);

  if (step === "interview") {
    return (
      <InterviewChat
        token={token}
        initialConversation={initialConversation}
        initialStatus={initialStatus}
        company={company}
        brandless={brandless}
        headingOverride={headingOverride}
        brandName={brandName}
        accentColor={accentColor}
        logoUrl={logoUrl}
      />
    );
  }

  return (
    <ParticipantShell
      brandless={brandless}
      brandName={brandName}
      accentColor={accentColor}
      logoUrl={logoUrl}
    >
      {step === "screening" ? (
        <ScreeningForm
          questions={screeningQuestions}
          planTitle={headingOverride}
          // E3 stub: reveal the interview. E4 → evaluateScreening result.
          onComplete={() => setStep("interview")}
        />
      ) : (
        <RejectionPanel onRetry={() => setStep("screening")} />
      )}
    </ParticipantShell>
  );
}
