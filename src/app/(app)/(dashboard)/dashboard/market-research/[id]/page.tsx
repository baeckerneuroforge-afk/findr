import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import {
  researchInterviewUrl,
  researchOpenLinkUrl,
} from "@/lib/email/research-invite";
import {
  getProlificCredentialSummary,
  getProlificStudyForPlan,
} from "@/lib/panel/service";
import {
  countCompletedSessionsForPlan,
  getResearchPlan,
  listSessionsForPlan,
  type PlanSessionStatus,
} from "@/lib/research/plans-service";
import { getOpenLinkForPlan } from "@/lib/research/open-links";
import { listInvitesForPlan } from "@/lib/research/scheduling";
import {
  listInvitedPoolMemberIds,
  listPoolMembers,
  listQuotaProgress,
} from "@/lib/research/participant-pool";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { BulkInviteForm } from "@/components/dashboard/BulkInviteForm";
import { CopyInterviewLinkButton } from "@/components/dashboard/CopyInterviewLinkButton";
import { DeleteParticipantButton } from "@/components/dashboard/DeleteParticipantButton";
import { EditParticipantButton } from "@/components/dashboard/EditParticipantButton";
import { InviteForm } from "@/components/dashboard/InviteForm";
import { InviteFromPoolForm } from "@/components/dashboard/InviteFromPoolForm";
import { OpenLinkPanel } from "@/components/dashboard/OpenLinkPanel";
import { PlanQuotaPanel } from "@/components/dashboard/PlanQuotaPanel";
import { PlanStatusControl } from "@/components/dashboard/PlanStatusControl";
import { ProlificDraftPanel } from "@/components/dashboard/ProlificDraftPanel";
import { ScreeningQuestionsPanel } from "@/components/dashboard/ScreeningQuestionsPanel";
import { ScheduleInviteAction } from "@/components/dashboard/ScheduleInviteAction";
import { SectionRail } from "@/components/dashboard/SectionRail";
import { SendInviteAction } from "@/components/dashboard/SendInviteAction";
import { StickyStudyBar } from "@/components/dashboard/StickyStudyBar";
import { ENABLED_MODULES } from "@/config/modules";

/**
 * /dashboard/market-research/[id] — Markt-Kampagne (Phase M3).
 *
 * Der KAMPAGNEN-FLOW: bündelt die schon existierenden Teile an EINEM Ort —
 * Topics/Ziel + Agenten-Script (Plan-Felder), Screening
 * (ScreeningQuestionsPanel), offener Link (OpenLinkPanel), Quoten
 * (PlanQuotaPanel) und die Auswertung (Synthese/Chat/Export, verlinkt auf den
 * GETEILTEN /synthesis-Pfad). ALLE Panels sind die der Product-Discovery-
 * Detailseite — WIEDERVERWENDET, nicht neu gebaut. Der Unterschied zu
 * Discovery ist study_type + die Bündelung als Kampagnen-Erlebnis +
 * der Ziel-Pool-Fortschritt (§7). DIESELBE Engine darunter.
 *
 * Die Synthese/Chat/Highlight-Reel/Export leben weiter auf
 * /dashboard/research-plans/[id]/synthesis — EIN Synthese-Pfad, eine Engine
 * (kein zweiter Auswertungs-Bau). Der Markt-Diskriminator macht die Engine
 * (M2) typ-bewusst; hier wird nur verlinkt.
 */

type Status = "draft" | "active" | "completed" | "archived";

const STATUS_VARIANT: Record<Status, BadgeVariant> = {
  draft: "default",
  active: "success",
  completed: "low",
  archived: "default",
};

type InviteStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

const INVITE_STATUS_VARIANT: Record<InviteStatus, BadgeVariant> = {
  pending: "default",
  scheduled: "default",
  in_progress: "default",
  completed: "success",
  cancelled: "default",
  no_show: "critical",
};

const MODE_LABEL: Record<string, string> = {
  text: "Text",
  voice: "Voice",
  video: "Video",
};

// Sessions sind feiner als Pläne: open=läuft gerade (default), completed=
// fertig (success), abandoned=abgebrochen (default — kein Alarm, ein
// abgebrochenes Interview ist Alltag, kein Fehlerzustand).
const SESSION_STATUS_VARIANT: Record<PlanSessionStatus, BadgeVariant> = {
  open: "default",
  completed: "success",
  abandoned: "default",
};

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Mit Uhrzeit — mehrere Interviews am selben Tag sind der Normalfall.
function formatDateTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MarketCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      if (err.code === "no_auth") redirect("/sign-in");
      if (err.code === "no_org") redirect("/onboarding/create-org");
      redirect("/sign-in");
    }
    throw err;
  }

  const t = await getTranslations("research.plans");
  const tm = await getTranslations("research.market");
  const ts = await getTranslations("syntheticTest");
  const locale = await getLocale();

  const { id: planId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) notFound();

  // Symmetric guard to the discovery detail's market-redirect: this area is the
  // Market-Research experience only. A product_discovery plan reached here
  // (stale link / hand-typed URL) belongs on the discovery detail — send it
  // there rather than render the campaign chrome around it.
  if (plan.studyType !== "market_research") {
    if (!ENABLED_MODULES.productDiscovery) redirect("/dashboard");
    redirect(`/dashboard/research-plans/${planId}`);
  }

  const invites = await listInvitesForPlan(orgId, planId);

  // Pool + Quoten + offener Link + Ziel-Pool-Fortschritt + Prolific-Credential
  // + persistierter Prolific-Draft — alle unabhängig, parallel (kein N+1). Der
  // completed-Count ist die §7-Messung; null → "—" (fail-open).
  // getProlificCredentialSummary degradiert auf null, wenn kein Token verbunden
  // ist — das Panel zeigt dann den "erst Prolific verbinden"-Leerzustand, genau
  // wie auf der Product-Discovery-Detailseite. getProlificStudyForPlan ist
  // ebenso fail-open (null = nie ein Draft angelegt oder Migration fehlt noch).
  const [
    poolMembers,
    invitedPoolMemberIds,
    quotas,
    openLink,
    completed,
    prolificCredential,
    prolificStudy,
    sessions,
  ] = await Promise.all([
    listPoolMembers(orgId),
    listInvitedPoolMemberIds(orgId, planId),
    listQuotaProgress(orgId, planId),
    getOpenLinkForPlan(orgId, planId),
    countCompletedSessionsForPlan(orgId, planId),
    getProlificCredentialSummary(orgId),
    getProlificStudyForPlan(orgId, planId),
    listSessionsForPlan(orgId, planId),
  ]);
  const poolRoles = [
    ...new Set(poolMembers.map((m) => m.role).filter((r): r is string => !!r)),
  ].sort();

  const openLinkView = openLink
    ? {
        status: openLink.status,
        maxSessions: openLink.max_sessions,
        validUntil: openLink.valid_until,
        label: openLink.label,
      }
    : null;
  const openLinkShareUrl = openLink
    ? researchOpenLinkUrl(openLink.access_token)
    : null;
  const hasScreening = plan.screeningQuestions.length > 0;
  // Spiegelt die PD-Seite: zeigt im Panel den "Completion wired"-Badge, sobald
  // ein früherer Draft die Complete-/Screen-out-URLs in den offenen Link
  // geschrieben hat. Reiner Read aus openLink.panel_completion, kein Backend.
  const panelCompletionConfigured = Boolean(
    openLink?.panel_completion?.complete_url ||
      openLink?.panel_completion?.screenout_url,
  );

  // Ziel-Pool-Fortschritt (§7) — sample_target ist das studienweite Ziel,
  // completed der gemessene Fortschritt (NUR status='completed'). Die drei
  // Quota-Begriffe bleiben getrennt (siehe countCompletedSessionsForPlan).
  const sampleTarget = plan.sampleTarget;
  const targetReached =
    sampleTarget !== null && completed !== null && completed >= sampleTarget;
  const targetPct =
    sampleTarget !== null && sampleTarget > 0 && completed !== null
      ? Math.min(100, Math.round((completed / sampleTarget) * 100))
      : 0;

  // E4 (Konsole-v5): gruppierte Sektions-Navigation — NUR Anker-IDs + Labels,
  // jede Sektion behält ihre Komponente mit identischen Props („Umzug ohne
  // Umbau“). Die Labels sind die vorhandenen Sektions-Titel-Keys; die
  // Gruppen folgen der tatsächlichen DOM-Reihenfolge.
  const railGroups = [
    {
      label: tm("railOverview"),
      items: [{ id: "s-pool", label: tm("poolTitle") }],
    },
    {
      label: tm("railSetup"),
      items: [
        { id: "s-ziel", label: t("objective") },
        ...(plan.stimulusUrl
          ? [{ id: "s-stimulus", label: t("stimulusSectionTitle") }]
          : []),
        { id: "s-leitfaden", label: t("topicsTitle") },
        { id: "s-test", label: ts("linkOutTitle") },
      ],
    },
    {
      label: tm("railField"),
      items: [
        { id: "s-teilnehmer", label: t("participantsTitle") },
        { id: "s-screening", label: t("screeningTitle") },
        { id: "s-openlink", label: t("openLinkTitle") },
        { id: "s-prolific", label: tm("prolificTitle") },
        { id: "s-quotas", label: t("quotasTitle") },
        { id: "s-sessions", label: tm("sessionsTitle") },
      ],
    },
    {
      label: tm("railAnalysis"),
      items: [
        { id: "s-auswertung", label: t("synthesisLinkTitle") },
        { id: "s-lifecycle", label: t("lifecycleTitle") },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2">
          <Link
            href="/dashboard/market-research"
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {tm("backToCampaigns")}
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-display text-neutral-900">{plan.title}</h1>
              <Badge variant="low">{tm("studyTypeBadge")}</Badge>
              <Badge variant={STATUS_VARIANT[plan.status]}>
                {t(`status.${plan.status}`)}
              </Badge>
            </div>
            <p className="mt-1 text-small text-neutral-500">
              {t("createdAt", { date: formatDate(plan.createdAt, locale) })}
            </p>
          </div>
        </div>
      </div>

      <StickyStudyBar
        title={plan.title}
        statusLabel={t(`status.${plan.status}`)}
        statusVariant={STATUS_VARIANT[plan.status]}
        progressText={
          completed !== null && sampleTarget !== null
            ? tm("poolProgress", { completed, target: sampleTarget })
            : null
        }
        ctaHref={`/dashboard/research-plans/${plan.id}/synthesis`}
        ctaLabel={t("viewSynthesis")}
      />

      {/* E4 (Konsole-v5): ab lg zweispaltig — links die Sektions-Rail mit
          Scroll-Spy, rechts ALLE bisherigen Sektionen mit identischen Props.
          Einzig der Ziel-Pool rückte als „Überblick“ an den Anfang; die
          Sektions-Einrückung darunter bleibt unangetastet (diff-schonender
          Umzug ohne Umbau). */}
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <SectionRail groups={railGroups} ariaLabel={tm("railAria")} />
        <div className="min-w-0 space-y-8">

      {/* Ziel-Pool-Fortschritt (§7) — "47 von 200". Misst sample_target gegen
          abgeschlossene Interviews. Bewusst GETRENNT von den Rollen-Quoten
          (unten) und vom max_sessions-Spend-Cap des offenen Links. */}
      <section id="s-pool" className="scroll-mt-28 space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{tm("poolTitle")}</h2>
          <p className="text-small text-neutral-500">{tm("poolDesc")}</p>
        </div>
        <Card>
          <CardBody>
            {completed === null ? (
              <p className="text-small text-neutral-500">
                {tm("poolCountUnknownDesc")}
              </p>
            ) : sampleTarget !== null ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <span className="text-h2 text-neutral-900">
                    {tm("poolProgress", {
                      completed,
                      target: sampleTarget,
                    })}
                  </span>
                  <span className="text-small text-neutral-500">
                    {tm("poolProgressCaption")}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full ${
                      targetReached ? "bg-success-500" : "bg-primary-500"
                    }`}
                    style={{ width: `${targetPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-body text-neutral-700">
                {tm("poolNoTarget")}{" "}
                <span className="text-neutral-500">
                  {tm("poolNoTargetCount", { completed })}
                </span>
              </p>
            )}
          </CardBody>
        </Card>
      </section>

      {/* Objective + persona + sample-target */}
      <Card id="s-ziel" className="scroll-mt-28">
        <CardHeader>
          <h2 className="text-h3 text-neutral-900">{t("objective")}</h2>
        </CardHeader>
        <CardBody>
          <p className="whitespace-pre-wrap text-body text-neutral-700">
            {plan.objective}
          </p>

          {(plan.persona || sampleTarget !== null) && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  {t("targetPersona")}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                  {plan.persona ?? (
                    <span className="text-neutral-400">
                      {t("personaNotSpecified")}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  {t("sampleTargetField")}
                </div>
                <p className="mt-1 text-body text-neutral-700">
                  {sampleTarget !== null ? (
                    t("sampleTargetValue", { count: sampleTarget })
                  ) : (
                    <span className="text-neutral-400">
                      {t("sampleOpenEnded")}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Stimulus + KI-Analyse (Etappe 2) — nur wenn die Studie einen Stimulus
          trägt (creative_test/concept_test); Pläne ohne Stimulus rendern hier
          byte-identisch nichts. Asset-Vorschau + Beschreibung + Analyse-Status;
          bei 'done' eine aufklappbare (native <details>, collapsed by default,
          kein Client-JS) Darstellung des analysis-Objekts aus dem Envelope —
          bewusst NICHT der textBlock, der ist fürs Modell gerendert. */}
      {plan.stimulusUrl && (
        <section id="s-stimulus" className="scroll-mt-28 space-y-3">
          <div>
            <h2 className="text-h3 text-neutral-900">
              {t("stimulusSectionTitle")}
            </h2>
            <p className="text-small text-neutral-500">
              {t("stimulusSectionDesc")}
            </p>
          </div>
          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {plan.stimulusType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={plan.stimulusUrl}
                    alt={t("stimulusThumbAlt")}
                    className="h-20 w-20 shrink-0 rounded-md border border-neutral-200 bg-white object-contain p-1"
                  />
                ) : plan.stimulusType === "video" ? (
                  // Abspielbare Vorschau des Video-Stimulus (Etappe 3).
                  <video
                    src={plan.stimulusUrl}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={t("stimulusThumbAlt")}
                    className="h-28 w-44 shrink-0 rounded-md border border-neutral-200 bg-white object-contain p-1"
                  />
                ) : (
                  <a
                    href={plan.stimulusUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-small text-primary-700 underline underline-offset-2 hover:text-primary-800"
                  >
                    {plan.stimulusUrl}
                  </a>
                )}
                <Badge variant="default">
                  {plan.stimulusType === "image"
                    ? t("stimulusModeImage")
                    : plan.stimulusType === "video"
                      ? t("stimulusModeVideo")
                      : t("stimulusModeLink")}
                </Badge>
                {/* Analyse-Status — derselbe Stand wie im Formular (DB-Read).
                    'pending' ist hier nur nach einem abgebrochenen Status-Write
                    sichtbar (die Analyse selbst läuft synchron im Upload). */}
                {plan.stimulusAnalysisStatus === "pending" && (
                  <span className="inline-flex items-center gap-2 text-caption text-neutral-500">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                    {t("stimulusAnalysisPending")}
                  </span>
                )}
                {plan.stimulusAnalysisStatus === "done" && (
                  <Badge variant="success">{t("stimulusAnalysisDone")}</Badge>
                )}
              </div>

              {plan.stimulusDescription && (
                <div>
                  <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                    {t("stimulusDetailDescLabel")}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                    {plan.stimulusDescription}
                  </p>
                </div>
              )}

              {/* failed — dezent (neutral, kein Alarm): das Interview nutzt den
                  Stimulus auch ohne Analyse. */}
              {plan.stimulusAnalysisStatus === "failed" && (
                <p className="text-caption text-neutral-500">
                  {t("stimulusAnalysisFailed")}
                </p>
              )}

              {plan.stimulusAnalysisStatus === "done" &&
                plan.stimulusAnalysis && (
                  <details className="group rounded-md border border-neutral-200">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-small font-medium text-neutral-700 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform group-open:rotate-90"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                      {t("stimulusAnalysisSummary")}
                    </summary>
                    <div className="space-y-4 border-t border-neutral-200 px-3 py-3">
                      <div>
                        <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                          {t("saLayout")}
                        </div>
                        <p className="mt-1 text-small text-neutral-700">
                          {plan.stimulusAnalysis.analysis.layout}
                        </p>
                      </div>
                      <div>
                        <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                          {t("saFarbwelt")}
                        </div>
                        <p className="mt-1 text-small text-neutral-700">
                          {plan.stimulusAnalysis.analysis.farbwelt}
                        </p>
                      </div>
                      <div>
                        <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                          {t("saBildelemente")}
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {plan.stimulusAnalysis.analysis.bildelemente.map(
                            (item, i) => (
                              <li
                                key={i}
                                className="text-small text-neutral-700"
                              >
                                {item}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                      {plan.stimulusAnalysis.analysis.textImBild.length > 0 && (
                        <div>
                          <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                            {t("saTextImBild")}
                          </div>
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {plan.stimulusAnalysis.analysis.textImBild.map(
                              (item, i) => (
                                <li
                                  key={i}
                                  className="text-small text-neutral-700"
                                >
                                  „{item}“
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                      <div>
                        <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                          {t("saClaim")}
                        </div>
                        <p className="mt-1 text-small text-neutral-700">
                          {plan.stimulusAnalysis.analysis.claimBotschaft}
                        </p>
                      </div>
                      {plan.stimulusAnalysis.analysis.gestaltungsentscheidungen
                        .length > 0 && (
                        <div>
                          <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                            {t("saGestaltung")}
                          </div>
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {plan.stimulusAnalysis.analysis.gestaltungsentscheidungen.map(
                              (item, i) => (
                                <li
                                  key={i}
                                  className="text-small text-neutral-700"
                                >
                                  {item}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                      <div>
                        <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                          {t("saFrageansaetze")}
                        </div>
                        <ol className="mt-1 list-decimal space-y-1 pl-5">
                          {plan.stimulusAnalysis.analysis.frageansaetze.map(
                            (item, i) => (
                              <li
                                key={i}
                                className="text-small text-neutral-700"
                              >
                                {item}
                              </li>
                            ),
                          )}
                        </ol>
                      </div>
                      {/* Kein Re-Analyse-Button: die Stimulus-Route bietet keinen
                          Trigger ohne neuen Datei-Upload (Etappe-2-Befund) —
                          erneutes Hochladen analysiert neu. */}
                      <p className="text-caption text-neutral-400">
                        {t("stimulusAnalysisGeneratedAt", {
                          date: formatDate(
                            plan.stimulusAnalysis.generatedAt,
                            locale,
                          ),
                        })}
                      </p>
                    </div>
                  </details>
                )}
            </CardBody>
          </Card>
        </section>
      )}

      {/* Topics (read-only) */}
      <section id="s-leitfaden" className="scroll-mt-28 space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">{t("topicsTitle")}</h2>
          <p className="text-body text-neutral-500">{t("topicsDesc")}</p>
        </div>
        {plan.topics.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-4 text-center text-body text-neutral-500">
                {t("noTopics")}
              </p>
            </CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {plan.topics.map((topic, i) => (
              <li key={i}>
                <Card>
                  <CardBody className="space-y-3">
                    <div>
                      <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                        {t("topicN", { n: i + 1 })}
                      </div>
                      <div className="mt-0.5 text-h3 text-neutral-900">
                        {topic.topic}
                      </div>
                    </div>
                    <div>
                      <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                        {t("intent")}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                        {topic.intent}
                      </p>
                    </div>
                    {topic.hypotheses && topic.hypotheses.length > 0 && (
                      <div>
                        <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                          {t("privateHypothesesCount", {
                            count: topic.hypotheses.length,
                          })}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {topic.hypotheses.map((h, hi) => (
                            <li
                              key={hi}
                              className="border-l-2 border-neutral-200 pl-3 text-small text-neutral-600"
                            >
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Studie testen (Trockenlauf) — synthetische Test-Teilnehmer, BEVOR echte
          Menschen eingeladen werden. Eigene Route + eigene (separate) Tabellen;
          zählt NICHT in den Ziel-Pool und fließt NICHT in die echte Synthese. */}
      <section id="s-test" className="scroll-mt-28 space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{ts("linkOutTitle")}</h2>
          <p className="text-small text-neutral-500">{ts("linkOutDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body text-neutral-700">{ts("pageSubtitle")}</p>
              <Link
                href={`/dashboard/market-research/${plan.id}/test`}
                className="shrink-0 text-body-strong text-primary-700 hover:underline"
              >
                {ts("linkOutCta")}
              </Link>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Teilnehmer */}
      <section id="s-teilnehmer" className="scroll-mt-28 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-h2 text-neutral-900">
              {t("participantsTitle")}
            </h2>
            <p className="text-body text-neutral-500">
              {invites.length === 0
                ? t("participantsEmptyDesc")
                : t("participantsCountDesc", { count: invites.length })}
            </p>
          </div>
        </div>

        {invites.length > 0 && (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>{t("colName")}</TH>
                  <TH>{t("colEmail")}</TH>
                  <TH>{t("colMode")}</TH>
                  <TH>{t("colSchedule")}</TH>
                  <TH>{t("colStatus")}</TH>
                  <TH>{t("colSend")}</TH>
                  <TH>{t("colLink")}</TH>
                  <TH>{t("colActions")}</TH>
                </TR>
              </THead>
              <TBody>
                {invites.map((invite) => {
                  const planLocked =
                    plan.status === "archived" || plan.status === "completed";
                  const inviteTerminal =
                    invite.status === "completed" ||
                    invite.status === "cancelled" ||
                    invite.status === "no_show";
                  const scheduleDisabled = planLocked || inviteTerminal;
                  const deleteDisabled = plan.status === "archived";
                  return (
                    <TR key={invite.id}>
                      <TD className="text-body-strong text-neutral-900">
                        {invite.contact_label}
                      </TD>
                      <TD className="text-neutral-700">
                        {invite.contact_email ?? (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TD>
                      <TD className="text-neutral-700">
                        {MODE_LABEL[invite.mode_preference] ??
                          invite.mode_preference}
                      </TD>
                      <TD>
                        <ScheduleInviteAction
                          inviteId={invite.id}
                          scheduledAt={invite.scheduled_at}
                          disabled={scheduleDisabled}
                        />
                      </TD>
                      <TD>
                        <Badge
                          variant={
                            INVITE_STATUS_VARIANT[
                              invite.status as InviteStatus
                            ] ?? "default"
                          }
                        >
                          {INVITE_STATUS_VARIANT[invite.status as InviteStatus]
                            ? t(`inviteStatus.${invite.status}`)
                            : invite.status}
                        </Badge>
                      </TD>
                      <TD>
                        <SendInviteAction
                          inviteId={invite.id}
                          scheduledAt={invite.scheduled_at}
                          invitedAt={invite.invited_at}
                          contactEmail={invite.contact_email}
                          disabled={scheduleDisabled}
                        />
                      </TD>
                      <TD>
                        <CopyInterviewLinkButton
                          link={
                            invite.access_token
                              ? researchInterviewUrl(invite.access_token)
                              : null
                          }
                        />
                      </TD>
                      <TD>
                        <div className="flex items-center gap-1">
                          <EditParticipantButton
                            planId={plan.id}
                            participantId={invite.id}
                            initialLabel={invite.contact_label}
                            initialEmail={invite.contact_email}
                            disabled={deleteDisabled}
                          />
                          <DeleteParticipantButton
                            planId={plan.id}
                            participantId={invite.id}
                            contactLabel={invite.contact_label}
                            disabled={deleteDisabled}
                          />
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        )}

        {plan.status === "archived" ? (
          <Card>
            <CardBody>
              <p className="py-3 text-center text-small text-neutral-500">
                {t("archivedNote")}
              </p>
            </CardBody>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <h3 className="text-h3 text-neutral-900">
                  {t("addParticipant")}
                </h3>
              </CardHeader>
              <CardBody>
                <InviteForm planId={plan.id} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-h3 text-neutral-900">{t("bulkTitle")}</h3>
              </CardHeader>
              <CardBody>
                <BulkInviteForm planId={plan.id} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-h3 text-neutral-900">
                  {t("fromPoolTitle")}
                </h3>
              </CardHeader>
              <CardBody>
                <InviteFromPoolForm
                  planId={plan.id}
                  poolMembers={poolMembers}
                  invitedMemberIds={invitedPoolMemberIds}
                />
              </CardBody>
            </Card>
          </>
        )}
      </section>

      {/* Screening-Fragen */}
      <section id="s-screening" className="scroll-mt-28 space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("screeningTitle")}</h2>
          <p className="text-small text-neutral-500">{t("screeningDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <ScreeningQuestionsPanel
              planId={plan.id}
              initialQuestions={plan.screeningQuestions}
              disabled={plan.status === "archived"}
            />
          </CardBody>
        </Card>
      </section>

      {/* Offener Link — der Kern des Markt-Outreach: EIN studienweiter,
          öffentlich teilbarer Link für anonyme Walk-ins. */}
      <section id="s-openlink" className="scroll-mt-28 space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("openLinkTitle")}</h2>
          <p className="text-small text-neutral-500">{t("openLinkDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <OpenLinkPanel
              planId={plan.id}
              openLink={openLinkView}
              shareUrl={openLinkShareUrl}
              hasScreening={hasScreening}
              disabled={plan.status === "archived"}
            />
          </CardBody>
        </Card>
      </section>

      {/* Prolific Panel-Anbieter — baut NUR einen unveröffentlichten Draft im
          Kunden-Prolific aus dem AKTIVEN offenen Link und schreibt die erzeugten
          Completion-URLs additiv in research_open_links.panel_completion. Kein
          Publish, kein Funding. Identische Verdrahtung wie auf der Product-
          Discovery-Detailseite — dieselbe Komponente, dieselben Props; nur die
          Section-Überschrift ist markt-passend (de+en via research.market).
          Sitzt bewusst direkt unter dem offenen Link (der die Teilnehmer-URL
          liefert) und vor den Quoten. */}
      <section id="s-prolific" className="scroll-mt-28 space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{tm("prolificTitle")}</h2>
          <p className="text-small text-neutral-500">{tm("prolificDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <ProlificDraftPanel
              planId={plan.id}
              planTitle={plan.title}
              planObjective={plan.objective}
              sampleTarget={plan.sampleTarget}
              openLink={
                openLink
                  ? {
                      status: openLink.status,
                      maxSessions: openLink.max_sessions,
                    }
                  : null
              }
              credentialStatus={prolificCredential?.status ?? "missing"}
              panelCompletionConfigured={panelCompletionConfigured}
              panelStudy={
                prolificStudy
                  ? {
                      providerStudyId: prolificStudy.providerStudyId,
                      status: prolificStudy.status,
                      createdAt: prolificStudy.createdAt,
                      submissionCounts: prolificStudy.submissionCounts,
                      lastSyncedAt: prolificStudy.lastSyncedAt,
                    }
                  : null
              }
              disabled={plan.status === "archived"}
            />
          </CardBody>
        </Card>
      </section>

      {/* Screening-Quoten (Rollen-Pool) — bewusst getrennt vom Ziel-Pool oben. */}
      <section id="s-quotas" className="scroll-mt-28 space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("quotasTitle")}</h2>
          <p className="text-small text-neutral-500">{t("quotasDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <PlanQuotaPanel
              planId={plan.id}
              quotas={quotas}
              availableRoles={poolRoles}
              disabled={plan.status === "archived"}
            />
          </CardBody>
        </Card>
      </section>

      {/* Interviews (Voice Phase 2 E2) — die geführten Sessions dieser Studie,
          neueste zuerst, serverseitig auf 50 gecappt (listSessionsForPlan).
          Reine Lese-Ansicht; jede Zeile verlinkt auf die Transkript-Subroute.
          Sitzt bewusst direkt VOR der Auswertung: die Interviews sind das
          Material, das die Synthese speist. */}
      <section id="s-sessions" className="scroll-mt-28 space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{tm("sessionsTitle")}</h2>
          <p className="text-small text-neutral-500">{tm("sessionsDesc")}</p>
        </div>
        <Card>
          {sessions.length === 0 ? (
            <CardBody>
              <p className="py-4 text-center text-body text-neutral-500">
                {tm("sessionsEmpty")}
              </p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/dashboard/market-research/${plan.id}/sessions/${session.id}`}
                    className="block px-4 py-3 transition-colors hover:bg-neutral-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={SESSION_STATUS_VARIANT[session.status]}>
                        {tm(`sessionStatus.${session.status}`)}
                      </Badge>
                      {session.mode === "voice" && (
                        <Badge variant="default">
                          <svg
                            className="h-3 w-3 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" x2="12" y1="19" y2="22" />
                          </svg>
                          {tm("sessionVoiceBadge")}
                        </Badge>
                      )}
                      <span className="text-small text-neutral-500">
                        {tm("sessionTurnCount", { count: session.turnCount })}
                      </span>
                      <span className="ml-auto text-small text-neutral-400">
                        {formatDateTime(session.createdAt, locale)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-small text-neutral-700">
                      {session.preview ?? (
                        <span className="text-neutral-400">
                          {tm("sessionNoPreview")}
                        </span>
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Auswertung — GETEILTER Synthese-Pfad (eine Engine, M2-typ-bewusst). */}
      <section id="s-auswertung" className="scroll-mt-28 space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">
            {t("synthesisLinkTitle")}
          </h2>
          <p className="text-small text-neutral-500">
            {t("synthesisLinkDesc")}
          </p>
        </div>
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body text-neutral-700">
                {t("synthesisLinkBody")}
              </p>
              <Link
                href={`/dashboard/research-plans/${plan.id}/synthesis`}
                className="shrink-0 text-body-strong text-primary-700 hover:underline"
              >
                {t("viewSynthesis")}
              </Link>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Status-Lifecycle */}
      <section id="s-lifecycle" className="scroll-mt-28 space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("lifecycleTitle")}</h2>
          <p className="text-small text-neutral-500">{t("lifecycleDesc")}</p>
        </div>
        <PlanStatusControl planId={plan.id} status={plan.status} />
      </section>
        </div>
      </div>

      {/* O6-Folge: stilles 30s-Polling — Ziel-Pool, Teilnehmer-Status und
          die Interviews-Liste bleiben aktuell; Formular-State der Panels
          überlebt den refresh (etabliertes AutoRefresh-Muster). */}
      <AutoRefresh />
    </div>
  );
}
