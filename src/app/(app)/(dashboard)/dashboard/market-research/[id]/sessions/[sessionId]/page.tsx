import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import {
  getResearchPlan,
  getSessionWithTranscript,
  type PlanSessionStatus,
} from "@/lib/research/plans-service";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { ENABLED_MODULES } from "@/config/modules";

/**
 * /dashboard/market-research/[id]/sessions/[sessionId] — Interview-Transkript
 * (Voice Phase 2 E2). Reine Lese-Ansicht des vollständigen Gesprächs.
 *
 * Mirrors the dry-run subroute's auth + plan-load + study_type guard EXACTLY
 * (test/page.tsx): requireOrgId → getResearchPlan(orgId, planId) → market
 * guard. Die Session selbst kommt aus getSessionWithTranscript, das die
 * plan_id-Bindung serverseitig erzwingt — eine fremde sessionId unter dieser
 * Plan-URL löst nie auf (null → notFound()).
 */

const SESSION_STATUS_VARIANT: Record<PlanSessionStatus, BadgeVariant> = {
  open: "default",
  completed: "success",
  abandoned: "default",
};

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

export default async function MarketSessionTranscriptPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
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

  const tm = await getTranslations("research.market");
  const locale = await getLocale();

  const { id: planId, sessionId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) notFound();

  // Symmetric guard to the campaign detail page: this is the Market-Research
  // experience only. A discovery plan reached here belongs on the discovery side.
  if (plan.studyType !== "market_research") {
    if (!ENABLED_MODULES.productDiscovery) redirect("/dashboard");
    redirect(`/dashboard/research-plans/${planId}`);
  }

  const session = await getSessionWithTranscript(orgId, planId, sessionId);
  if (!session) notFound();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2">
          <Link
            href={`/dashboard/market-research/${planId}`}
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {tm("transcriptBack")}
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">
          {tm("transcriptTitle")}
        </h1>
        <p className="mt-1 text-small text-neutral-400">{plan.title}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
            {tm("sessionTurnCount", { count: session.conversation.length })}
          </span>
          <span className="text-small text-neutral-400">
            {session.completedAt
              ? tm("transcriptCompletedAt", {
                  date: formatDateTime(session.completedAt, locale),
                })
              : tm("transcriptStartedAt", {
                  date: formatDateTime(session.createdAt, locale),
                })}
          </span>
        </div>
      </div>

      {/* Gesprächsverlauf — Interviewer links (neutral), Teilnehmer rechts
          (primary-Fläche). Bewusst die Chat-Lesrichtung der Teilnehmer-Ansicht
          gespiegelt: der Forscher liest die Teilnehmer-Stimme als Gegenüber. */}
      <Card>
        <CardBody>
          {session.conversation.length === 0 ? (
            <p className="py-4 text-center text-body text-neutral-500">
              {tm("transcriptEmpty")}
            </p>
          ) : (
            <ol className="space-y-4">
              {session.conversation.map((turn, i) => (
                <li
                  key={i}
                  className={`flex ${
                    turn.role === "customer" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2.5 md:max-w-[70%] ${
                      turn.role === "customer"
                        ? "bg-primary-50 text-neutral-900"
                        : "bg-neutral-100 text-neutral-900"
                    }`}
                  >
                    <div
                      className={`text-caption font-medium uppercase tracking-wider ${
                        turn.role === "customer"
                          ? "text-primary-700"
                          : "text-neutral-400"
                      }`}
                    >
                      {turn.role === "customer"
                        ? tm("transcriptParticipantLabel")
                        : tm("transcriptInterviewerLabel")}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-body text-neutral-700">
                      {turn.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
