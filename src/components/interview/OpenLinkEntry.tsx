"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ScreeningQuestion } from "@/lib/schemas/screening";
import type { PanelInbound } from "@/lib/research/panel";
import { ParticipantShell } from "./ParticipantShell";
import { ScreeningForm } from "./ScreeningForm";
import { RejectionPanel } from "./RejectionPanel";

/**
 * Open-link participant entry gate (Phase 4, Baustein 2 — Etappe 4, WIRED).
 *
 * The open-path analog of ScreeningGate (which is the INVITE-path gate and POSTs
 * to /api/interview/[token]/screen — left byte-identical, NOT reused here). This
 * is a separate component so the two capabilities stay physically distinct: the
 * invite endpoint is NEVER reached from the open-link surface.
 *
 * Step machine, all white-label (ParticipantShell + `--brand-accent`):
 *   consent     → the MANDATORY DSGVO/privacy choke point for anonymous walk-ins.
 *                 The participant must actively confirm before anything else.
 *   screening   → the plan's screening questions (ScreeningForm, reused). Submit
 *                 POSTs to /api/interview/open/[token]/screen.
 *   rejected    → the "not a fit" screen (RejectionPanel, reused). Re-try allowed.
 *   unavailable → the link went dead (expired / no longer accepting) between
 *                 page load and submit — the server denied entry (403).
 *   full        → the max_sessions cap (E5) filled between page load and submit
 *                 (N other walk-ins qualified meanwhile) — the server denied
 *                 entry (403 {full:true}) BEFORE any Opus turn. Distinct, calmer
 *                 "study is full" copy vs. the generic "unavailable" screen.
 *
 * QUALIFIED is NOT a step: the server minted a FRESH session token, so we
 * redirect to /interview/[sessionToken] (router.push). The shared open-link
 * token is NEVER reused as a session token. Open links presuppose screening
 * (enforced server-side), so there is no no-screening "ready"/start path here —
 * a no-screening open link renders the page-level "unavailable" screen instead.
 */

export type OpenLinkStep =
  | "consent"
  | "screening"
  | "rejected"
  | "unavailable"
  | "full";

/** Mirrors ScreeningForm's submitted shape (number_range normalized to number). */
type AnswerMap = Record<string, string | string[] | number>;

export function OpenLinkEntry({
  token,
  questions,
  planTitle = null,
  brandName = null,
  accentColor = null,
  logoUrl = null,
  panel = null,
  panelScreenoutUrl = null,
  panelQuotafullUrl = null,
}: {
  token: string;
  questions: ScreeningQuestion[];
  planTitle?: string | null;
  brandName?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  /** Panel-Anbieter E1: validierte Inbound-ID, im POST-Body an die screen-Route
   *  weitergereicht → panel_context. Null für Nicht-Panel-Eintritte. */
  panel?: PanelInbound | null;
  /** Panel E2: fertig aufgebaute Screenout-Return-URL (Abweisung). Null → der
   *  bestehende Rejection-Screen, kein Redirect. */
  panelScreenoutUrl?: string | null;
  /** Panel E2: fertig aufgebaute QuotaFull-Return-URL (Cap voll am Submit). Null
   *  → der bestehende „Studie voll"-Screen, kein Redirect. */
  panelQuotafullUrl?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("interview");
  const [step, setStep] = useState<OpenLinkStep>("consent");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete(answers: AnswerMap) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/interview/open/${token}/screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Body carries the answers — never an org/plan/link field. The server
        // reads org_id + plan_id from the open-link row alone. PANEL E1: when this
        // is a panel entry, the validated inbound id rides along under `panel`;
        // the server RE-validates it before persisting (trust boundary).
        // E0: consentAccepted ist hier IMMER true — der mandatory ConsentStep
        // liegt strukturell vor diesem Submit (step machine). Das Flag
        // signalisiert nur die Gate-Bestätigung; der Zeitstempel entsteht
        // server-seitig bei Session-Creation.
        body: JSON.stringify(
          panel
            ? { answers, panel, consentAccepted: true }
            : { answers, consentAccepted: true },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as {
        qualified?: boolean;
        sessionToken?: string;
        available?: boolean;
        full?: boolean;
        error?: string;
      };

      // Link went dead between load and submit → the server denied entry (403).
      // full:true → the max_sessions cap (E5) filled meanwhile; show the calmer
      // "study is full" screen. Otherwise (expired / screening removed) → the
      // generic "not available" screen.
      if (res.status === 403 || data.available === false) {
        // PANEL E2: a panel participant on a now-full link is handed back to the
        // provider's QuotaFull return URL (correct disposition) instead of just
        // seeing the screen. Non-panel (or no template) → the existing screen.
        if (data.full === true && panelQuotafullUrl) {
          window.location.href = panelQuotafullUrl;
          return;
        }
        setStep(data.full === true ? "full" : "unavailable");
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? t("error.generic"));
      }
      if (data.qualified && data.sessionToken) {
        // The session was created (or, on panel re-entry, resumed) server-side
        // with a FRESH token. Redirect onto the existing /interview/[sessionToken]
        // path (loadByToken). Keep submitting=true; the gate unmounts on
        // navigation.
        router.push(`/interview/${data.sessionToken}`);
        return;
      }
      // qualified === false → not a fit. PANEL E2: hand a panel participant back
      // to the provider's Screenout return URL; non-panel → the rejection screen.
      if (panelScreenoutUrl) {
        window.location.href = panelScreenoutUrl;
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
      {step === "consent" && (
        <ConsentStep planTitle={planTitle} onAccept={() => setStep("screening")} />
      )}

      {step === "screening" && (
        <ScreeningForm
          questions={questions}
          planTitle={planTitle}
          submitting={submitting}
          error={error}
          onComplete={handleComplete}
        />
      )}

      {step === "rejected" && (
        <RejectionPanel
          onRetry={() => {
            setError(null);
            setStep("screening");
          }}
        />
      )}

      {step === "unavailable" && <TerminalNotice variant="unavailable" />}

      {step === "full" && <TerminalNotice variant="full" />}
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
      <h1 className="text-[18px] font-semibold text-[#221F2A]">
        {planTitle || t("open.consent.title")}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[#6B6678]">
        {t("open.consent.intro")}
      </p>

      <div className="mt-6 rounded-2xl border border-[#DCDEEF] bg-[#FAFAFE] px-5 py-5">
        <h2 className="text-[14px] font-semibold text-[#221F2A]">
          {t("open.consent.privacyTitle")}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6B6678]">
          {t("open.consent.privacyBody")}
        </p>
      </div>

      <label className="mt-6 flex items-start gap-3 text-[14px] leading-relaxed text-[#221F2A]">
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
 * Mid-flow terminal notice. Reached when the server denies entry at submit time
 * (403) — the link expired/stopped accepting ("unavailable") or hit its
 * max_sessions cap ("full") between page load and submit. Mirrors the same
 * open.unavailable.* / open.full.* copy as the page-level OpenLinkUnavailable
 * screen, rendered inside the already-mounted ParticipantShell.
 */
function TerminalNotice({ variant }: { variant: "unavailable" | "full" }) {
  const t = useTranslations("interview");
  const base = variant === "full" ? "open.full" : "open.unavailable";
  return (
    <div className="mb-10 mt-8 rounded-2xl border border-[#DCDEEF] bg-[#FAFAFE] px-6 py-10 text-center">
      <h1 className="text-[18px] font-semibold text-[#221F2A]">
        {t(`${base}.title`)}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#6B6678]">
        {t(`${base}.body`)}
      </p>
    </div>
  );
}
