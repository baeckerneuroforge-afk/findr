import { cache } from "react";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { InterviewChat } from "@/components/interview/InterviewChat";
import { InviteConsentGate } from "@/components/interview/InviteConsentGate";
import { ScreeningGate } from "@/components/interview/ScreeningGate";
import { VoiceInterviewView } from "@/components/interview/VoiceInterviewView";
import { InterviewUnavailable } from "@/components/interview/InterviewUnavailable";
import { getResearchPlan } from "@/lib/research/plans-service";
import { resolvePublicEntry } from "@/lib/voice-agent/session-service";
import { reapStaleVoiceSessionIfOverdue } from "@/lib/voice-interview/bridge-service";
import { getOrgBranding } from "@/lib/settings/org-settings";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { MESSAGES, translate } from "@/i18n/messages";

/**
 * Per-render memoization of resolvePublicEntry. The Next App Router runs
 * generateMetadata and the Page component in PARALLEL for the same request —
 * both call this helper with the same token. Without cache(), each would
 * independently run the entry resolution; for a no-screening research invite
 * that means the lazy-create branch fires twice (an INSERT race on the UNIQUE
 * access_token; pre-B2 also 2× Opus opening calls — the create is LLM-free
 * now, but the race stays worth avoiding). React.cache() memoizes per render so
 * both share ONE resolution. (For a screening-deferred or needs_screening token
 * no session is created at all, so there's nothing to race.)
 *
 * IMPORTANT: `cache` is from "react" (per-render dedup), NOT "next/cache".
 */
const getCachedEntry = cache(resolvePublicEntry);

/** Derive the metadata-relevant bits from either entry mode. */
function metaBits(
  entry: Awaited<ReturnType<typeof resolvePublicEntry>>,
): { isResearch: boolean; planTitle: string | null; language: Locale } | null {
  if (!entry) return null;
  if (entry.mode === "needs_screening") {
    return {
      isResearch: true,
      planTitle: entry.screening.planTitle,
      language: entry.screening.language,
    };
  }
  if (entry.mode === "not_available") {
    return { isResearch: true, planTitle: null, language: entry.language };
  }
  return {
    isResearch: entry.session.kind === "research",
    planTitle: entry.session.planTitle,
    language: entry.session.language,
  };
}

/**
 * Per-token metadata, localized to the session/invite language. Only `research`
 * surfaces (incl. needs_screening) get a plan-derived title; the plan title is
 * dynamic content interpolated as-is (never translated). Capability links are
 * never indexed.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const bits = metaBits(await getCachedEntry(token));
  const locale: Locale = bits?.language ?? DEFAULT_LOCALE;
  const robots = { index: false, follow: false } as const;

  if (!bits || !bits.isResearch) {
    return {
      title: translate(locale, "interview.meta.defaultTitle"),
      description: translate(locale, "interview.meta.defaultDescription"),
      robots,
    };
  }

  return {
    title: bits.planTitle
      ? translate(locale, "interview.meta.researchTitleWithPlan", {
          plan: bits.planTitle,
        })
      : translate(locale, "interview.meta.researchTitle"),
    description: translate(locale, "interview.meta.researchDescription"),
    robots,
  };
}

export default async function InterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const search = await searchParams;
  const entry = await getCachedEntry(token);
  if (!entry) notFound();

  // ── not_available — gültiger Token, aber die Studie ist (noch) nicht aktiv oder
  // bereits beendet. Render-only White-Label-Endbildschirm; KEINE Session wird
  // erzeugt (die autoritative Sperre sitzt im Resolver + am Mint). Laufende
  // Sessions erreichen diesen Zweig nie (loadByToken kürzt im Resolver vorher ab).
  if (entry.mode === "not_available") {
    const branding = await getOrgBranding(entry.orgId);
    return (
      <NextIntlClientProvider
        locale={entry.language}
        messages={{ interview: MESSAGES[entry.language].interview }}
      >
        <InterviewUnavailable
          reason={entry.reason}
          brandName={branding?.brandName ?? null}
          accentColor={branding?.accentColor ?? null}
          logoUrl={branding?.logoUrl ?? null}
        />
      </NextIntlClientProvider>
    );
  }

  // ── needs_screening — research invite whose plan has screening questions and
  // no session yet. The session was DEFERRED server-side (no Opus turn, no row);
  // render the white-label screening gate. The gate's submit hits
  // /api/interview/[token]/screen → qualified reloads into the session branch,
  // rejected shows the rejection screen.
  if (entry.mode === "needs_screening") {
    const s = entry.screening;
    // Screening is research-only → always white-label. Service-role read by
    // org_id (participant is unauthenticated); org_id never reaches the client.
    const branding = await getOrgBranding(s.orgId);
    return (
      <NextIntlClientProvider
        locale={s.language}
        messages={{ interview: MESSAGES[s.language].interview }}
      >
        {/* E0 — Consent + KI-Offenlegung VOR dem Screening (Parität zum
            Open-Link-Pfad, dessen ConsentStep ebenfalls vor dem Screening
            liegt). persist=false: es existiert noch keine Session-Row; das
            Flag reist im screen-POST mit (consentAccepted-Prop) und wird bei
            Session-Creation gestempelt. */}
        <InviteConsentGate
          token={token}
          persist={false}
          brandName={branding?.brandName ?? null}
          accentColor={branding?.accentColor ?? null}
          logoUrl={branding?.logoUrl ?? null}
        >
          <ScreeningGate
            token={token}
            questions={s.questions}
            planTitle={s.planTitle}
            brandName={branding?.brandName ?? null}
            accentColor={branding?.accentColor ?? null}
            logoUrl={branding?.logoUrl ?? null}
            consentAccepted
          />
        </InviteConsentGate>
      </NextIntlClientProvider>
    );
  }

  // ── session — existing or just-created (incl. post-qualified-screening). The
  // interview renders directly; screening is already passed or not required, so
  // there is no gate here. Behavior for post_loss / checkin / no-screening
  // research is byte-identical to before E4.
  const session = entry.session;
  const isResearch = session.kind === "research";
  // The session locale lives behind the unguessable token, not in a cookie, so
  // we override the request-resolved locale for this subtree EXPLICITLY. Only
  // the `interview` namespace is serialized to the client.
  const locale = session.language;

  // White-label: ONLY the research surface gets the Klymeo customer's branding.
  // post_loss / checkin keep the Klymeo chrome (branding null → neutral fallback).
  const [branding, plan] = await Promise.all([
    isResearch ? getOrgBranding(session.orgId) : Promise.resolve(null),
    isResearch && session.planId
      ? getResearchPlan(session.orgId, session.planId)
      : Promise.resolve(null),
  ]);
  const visualCaptureEnabled =
    isResearch && plan?.visualCaptureEnabled === true;
  // Phase 2c: research-only behavioural event tracking, gated on the plan flag.
  // Mirrors visualCaptureEnabled; non-research → plan null → false → byte-identical.
  const eventTrackingEnabled =
    isResearch && plan?.eventTrackingEnabled === true;
  // Voice Stage 1: research-only, gated on the plan's voice_enabled flag (the
  // backend already loaded it). Mirrors visualCaptureEnabled exactly; for
  // post_loss / checkin (non-research) plan is null → false → byte-identical.
  const voiceEnabled = isResearch && plan?.voiceEnabled === true;
  // TTS Stage 1: research-only, gated on the plan's tts_enabled flag. This
  // branch only forwards the inert backend flag; playback UI lands separately.
  const ttsEnabled = isResearch && plan?.ttsEnabled === true;
  const useCase = isResearch ? (plan?.useCase ?? null) : null;
  // Stimulus E4: the single asset shown beside the chat (split-view). Research-
  // only, defensive (?? null), and the plan record already carries both fields
  // (Etappe 1). For post_loss / checkin (non-research) both stay null → the
  // chat renders its existing single-column layout, byte-identical.
  // E5 Multi-Stimulus: das Set kommt aus dem SESSION-SNAPSHOT (public view),
  // nie live vom Plan — Agent-Regie und Teilnehmer-Panel sehen damit garantiert
  // dieselben Assets (R2/R6). Nicht-leer NUR für Set-Studien.
  const stimulusSet = isResearch ? session.stimuli : [];
  // Legacy-Single (O3: Verhaltensbruch vermeiden): NUR wenn kein Set existiert,
  // wie bisher live vom Plan — statisches Panel ab Sekunde 1.
  const stimulusUrl =
    isResearch && stimulusSet.length === 0 ? (plan?.stimulusUrl ?? null) : null;
  const stimulusType =
    isResearch && stimulusSet.length === 0 ? (plan?.stimulusType ?? null) : null;
  const ttsProps = { ttsEnabled };
  const useCaseProps = { useCase };
  // Phase 1b — the usability task shown to the PARTICIPANT. instruction +
  // targetUrl ONLY; successCriterion + prototypeHosting stay researcher-only
  // (never sent to the participant client — same demand-effect discipline as
  // stimulus_description / the agent `why`). Built from the live plan (already
  // loaded above); null for non-usability studies / studies without a task →
  // both views render byte-identically.
  const task =
    isResearch && plan?.useCase === "usability_test" && plan.taskDefinition
      ? {
          instruction: plan.taskDefinition.instruction,
          targetUrl: plan.taskDefinition.targetUrl ?? null,
        }
      : null;

  // Voice Phase 2 (E1, O1): voice-enabled studies render the LiveKit voice
  // view INSTEAD of the chat — the push-to-talk provisional in InterviewChat
  // becomes unreachable for voice plans. `?mode=text` is the participant's
  // explicit text fallback: the EXISTING chat with voiceEnabled=false. For
  // non-voice studies voiceEnabled is false → this branch never fires and the
  // chat below renders byte-identically.
  const useVoiceView = voiceEnabled && search.mode !== "text";

  // ── E0 — Consent + KI-Offenlegung für den Invite-Pfad (Session-Branch) ──
  // Gezeigt NUR, wenn (a) die Session offen ist, (b) noch kein Consent
  // gestempelt wurde und (c) der Teilnehmer noch nicht geantwortet hat. (c)
  // schützt Bestands-Sessions, die VOR der Migration mitten im Gespräch sind:
  // dort erscheint kein nachträgliches Gate (die laufende KI-Offenlegung
  // übernehmen Chat-Subtitle/-Footer bzw. das Voice-Intro). Ein reiner
  // Agent-Opening-Turn zählt nicht als begonnen. Accept → POST /consent
  // (server-seitiger Zeitstempel) → Interview rendert; das Opening streamt
  // erst DANACH (lazy via /stream bzw. Voice-Connect) — kein LLM-Turn und
  // keine Teilnehmer-Äußerung vor erfolgter Offenlegung (Art. 50(1) KI-VO).
  const needsConsent =
    session.status === "open" &&
    session.consentAcceptedAt === null &&
    !session.conversation.some((turn) => turn.role === "customer");

  const withConsentGate = (view: ReactNode) =>
    needsConsent ? (
      <InviteConsentGate
        token={token}
        persist
        brandName={branding?.brandName ?? null}
        accentColor={branding?.accentColor ?? null}
        logoUrl={branding?.logoUrl ?? null}
      >
        {view}
      </InviteConsentGate>
    ) : (
      view
    );

  if (useVoiceView) {
    // Crash-Netz (Q3 — Lazy-Completion beim Zugriff): Ist die Voice-Session
    // offen, aber überfällig (der Agent starb, bevor er /api/voice/complete
    // rief), schließen wir sie HIER ab — eine zurückkehrende Person sieht dann
    // sofort den Dankesscreen statt eines toten Live-Views. Der Status-Flip
    // läuft synchron (eine UPDATE); die Extraktion ist via after() ausgelagert,
    // blockiert das Rendern also nicht. Nicht überfällig → kein DB-Zugriff.
    const reaped = await reapStaleVoiceSessionIfOverdue({
      sessionId: session.id,
      status: session.status,
      kind: session.kind,
      startedAt: session.startedAt,
      maxDurationSeconds: session.maxDurationSeconds,
    });
    const voiceInitialStatus = reaped ? "completed" : session.status;
    const voiceView = (
      <VoiceInterviewView
        token={token}
        initialConversation={session.conversation}
        initialStatus={voiceInitialStatus}
        headingOverride={session.planTitle}
        brandName={branding?.brandName ?? null}
        accentColor={branding?.accentColor ?? null}
        logoUrl={branding?.logoUrl ?? null}
        panelCompleteRedirect={session.panelCompleteRedirect}
        stimulusUrl={stimulusUrl}
        stimulusType={stimulusType}
        // Phase 1b — die Usability-Aufgabe (nur instruction + targetUrl).
        task={task}
        // E6 Multi-Stimulus — Set-Panel mit Agent-Reveal per DataPacket;
        // leer → exakt der bisherige Single-/No-Stimulus-Pfad.
        stimuli={stimulusSet}
        // Fortschrittsbalken — System-Decke als Fallback-Nenner, bis der
        // Voice-Agent live progress-DataPackets sendet.
        progressTotal={session.progressTotal}
        // Zeitlimit-Countdown — der Voice-Agent erzwingt das Limit hart, die
        // UI spiegelt nur die verbleibende Zeit.
        maxDurationSeconds={session.maxDurationSeconds}
        startedAt={session.startedAt}
      />
    );
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={{ interview: MESSAGES[locale].interview }}
      >
        {/* reaped → das Interview ist bereits abgeschlossen (überfällig): KEIN
            Consent-Gate vor dem Dankesscreen — eine Einwilligung in ein bereits
            beendetes Interview wäre sinnlos und verwirrend. */}
        {reaped ? voiceView : withConsentGate(voiceView)}
      </NextIntlClientProvider>
    );
  }

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ interview: MESSAGES[locale].interview }}
    >
      {withConsentGate(
      <InterviewChat
        token={token}
        initialConversation={session.conversation}
        initialStatus={session.status}
        company={session.company}
        // Research-only: drop the Klymeo branding (logo + "Powered by …" footer)
        // and use the plan title as the h1. For post_loss / checkin both props
        // default to false/null, so render is byte-identical.
        brandless={isResearch}
        headingOverride={isResearch ? session.planTitle : null}
        // White-label props (research only; null elsewhere → neutral fallback).
        brandName={branding?.brandName ?? null}
        accentColor={branding?.accentColor ?? null}
        logoUrl={branding?.logoUrl ?? null}
        // Panel-Anbieter E2: server-seitig aufgebaute Complete-Return-URL. Nur für
        // Panel-Sessions gesetzt (sonst null → kein Redirect, byte-identisch).
        panelCompleteRedirect={session.panelCompleteRedirect}
        visualCaptureEnabled={visualCaptureEnabled}
        eventTrackingEnabled={eventTrackingEnabled}
        // O1: this branch renders either a non-voice study (voiceEnabled is
        // already false → value-identical) or the explicit ?mode=text fallback
        // of a voice study, where the push-to-talk provisional must stay off.
        voiceEnabled={false}
        // Stimulus E4 — drives the participant split-view (asset beside the
        // chat). Both null for non-research / no-stimulus studies → unchanged.
        stimulusUrl={stimulusUrl}
        stimulusType={stimulusType}
        // Phase 1b — die Usability-Aufgabe (nur instruction + targetUrl).
        task={task}
        // E5 Multi-Stimulus — Set-Panel mit Agent-Reveal; leer → Legacy-Pfad.
        stimuli={stimulusSet}
        // Fortschrittsbalken — gestellte Agent-Fragen ÷ diese System-Decke.
        progressTotal={session.progressTotal}
        // Zeitlimit-Countdown (Text: weich, schließt beim nächsten Senden).
        maxDurationSeconds={session.maxDurationSeconds}
        startedAt={session.startedAt}
        {...ttsProps}
        {...useCaseProps}
      />,
      )}
    </NextIntlClientProvider>
  );
}
