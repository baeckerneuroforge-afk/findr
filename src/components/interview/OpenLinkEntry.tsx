"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ScreeningQuestion } from "@/lib/schemas/screening";
import { ParticipantShell } from "./ParticipantShell";
import { ScreeningForm } from "./ScreeningForm";
import { RejectionPanel } from "./RejectionPanel";

/**
 * Open-link participant entry gate (Phase 4, Baustein 2 — Etappe 3, RENDER ONLY).
 *
 * The open-path analog of ScreeningGate (which is the INVITE-path gate and POSTs
 * to /api/interview/[token]/screen — left byte-identical, NOT reused here). This
 * is a separate component so the two capabilities stay physically distinct: the
 * invite endpoint is NEVER reached from the open-link surface.
 *
 * Step machine, all white-label (ParticipantShell + `--brand-accent`):
 *   consent   → the MANDATORY DSGVO/privacy choke point for anonymous walk-ins.
 *               The participant must actively confirm before anything else.
 *   screening → the plan's screening questions (ScreeningForm, reused).
 *   rejected  → the "not a fit" screen (RejectionPanel, reused).
 *   ready     → no-screening confirmation (consent is then the only gate).
 *
 * E3 boundary — this ONLY chooses WHAT renders. It creates NO session, fires NO
 * Opus turn, and calls NO endpoint. The screening submit is a local stub. E4
 * turns the submit into the real POST /api/interview/open/[token]/screen →
 * evaluateScreening (qualified → redirect to a FRESH session token; rejected →
 * the rejection screen + anonymous research_screening_responses quote).
 */

export type OpenLinkStep = "consent" | "screening" | "ready" | "rejected";

export function OpenLinkEntry({
  mode,
  questions,
  planTitle = null,
  brandName = null,
  accentColor = null,
  logoUrl = null,
  initialStep = "consent",
}: {
  mode: "needs_screening" | "ready";
  questions: ScreeningQuestion[];
  planTitle?: string | null;
  brandName?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  /** Live flow always begins at "consent"; a Vercel-preview ?view= override can
   *  force any step for visual QA (the page parses + validates it). */
  initialStep?: OpenLinkStep;
}) {
  const [step, setStep] = useState<OpenLinkStep>(initialStep);

  // After the participant confirms consent: screening form if the study has
  // questions, otherwise the no-screening ready screen. RENDER ONLY.
  const afterConsent: OpenLinkStep =
    mode === "needs_screening" ? "screening" : "ready";

  return (
    <ParticipantShell
      brandless
      brandName={brandName}
      accentColor={accentColor}
      logoUrl={logoUrl}
    >
      {step === "consent" && (
        <ConsentStep
          planTitle={planTitle}
          onAccept={() => setStep(afterConsent)}
        />
      )}

      {step === "screening" && (
        <ScreeningForm
          questions={questions}
          planTitle={planTitle}
          // E3 render-only STUB: no fetch, no session. Advancing to the
          // rejection screen previews that white-label state (the qualified
          // branch mints a fresh session — deliberately E4). E4 replaces this
          // with POST /api/interview/open/[token]/screen.
          onComplete={() => setStep("rejected")}
        />
      )}

      {step === "rejected" && (
        <RejectionPanel onRetry={() => setStep("screening")} />
      )}

      {step === "ready" && <ReadyStep />}
    </ParticipantShell>
  );
}

/**
 * The mandatory consent / landing step. A visible privacy notice for anonymous
 * walk-ins (no pre-known identity, the transcript may contain volunteered PII)
 * plus an explicit checkbox the participant must tick to proceed — the legal
 * basis + the natural choke point against accidental multi-entry.
 */
function ConsentStep({
  planTitle,
  onAccept,
}: {
  planTitle: string | null;
  onAccept: () => void;
}) {
  const t = useTranslations("interview");
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="mb-10 mt-2">
      <h1 className="text-[18px] font-semibold text-[#0E0A1F]">
        {planTitle || t("open.consent.title")}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[#6B6680]">
        {t("open.consent.intro")}
      </p>

      <div className="mt-6 rounded-2xl border border-[#E8E4F2] bg-[#FAFAFE] px-5 py-5">
        <h2 className="text-[14px] font-semibold text-[#0E0A1F]">
          {t("open.consent.privacyTitle")}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6B6680]">
          {t("open.consent.privacyBody")}
        </p>
      </div>

      <label className="mt-6 flex items-start gap-3 text-[14px] leading-relaxed text-[#0E0A1F]">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-[3px] h-4 w-4 accent-[var(--brand-accent)]"
        />
        <span>{t("open.consent.agree")}</span>
      </label>

      <button
        type="button"
        onClick={onAccept}
        disabled={!agreed}
        className="mt-6 h-[46px] rounded-xl bg-[var(--brand-accent)] px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {t("open.consent.continue")}
      </button>
    </div>
  );
}

/**
 * No-screening confirmation. After consent there are no questions, so this is a
 * static "you're all set" screen. E4 turns the open link's no-screening path
 * into a session mint + redirect to /interview/[freshSessionToken]; in E3 it
 * stays render-only (no button, no session).
 */
function ReadyStep() {
  const t = useTranslations("interview");
  return (
    <div className="mb-10 mt-8 rounded-2xl border border-[#E8E4F2] bg-[#FAFAFE] px-6 py-10 text-center">
      <h1 className="text-[18px] font-semibold text-[#0E0A1F]">
        {t("open.ready.title")}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#6B6680]">
        {t("open.ready.body")}
      </p>
    </div>
  );
}
