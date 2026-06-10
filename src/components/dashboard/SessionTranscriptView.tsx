import { getLocale, getTranslations } from "next-intl/server";

import { toBcp47 } from "@/i18n/locale";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import type {
  PlanSessionStatus,
  PlanSessionTranscript,
} from "@/lib/research/plans-service";

/**
 * E7b (Konsole-v5): gemeinsame Transkript-Darstellung — aus der
 * Voll-Seite (market-research/[id]/sessions/[sessionId]) extrahiert,
 * Markup unverändert, damit Voll-Seite und Intercepting-Drawer nie
 * driften. Zwei Bausteine statt einem, weil die Voll-Seite die
 * Badge-Zeile IM Seitenkopf trägt (mt-3 unter dem Titel), der Drawer
 * sie in seinem Scroll-Bereich: beide setzen die Bausteine an ihre
 * Stelle, der Inhalt bleibt identisch.
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

/** Status / Voice / Turn-Zahl / Zeitstempel einer Session. */
export async function SessionMetaBadges({
  session,
  className,
}: {
  session: PlanSessionTranscript;
  className?: string;
}) {
  const tm = await getTranslations("research.market");
  const locale = await getLocale();

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className ?? ""}`.trim()}
    >
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
  );
}

/** Der Gesprächsverlauf — Interviewer links (neutral), Teilnehmer rechts
 *  (primary-Fläche), gespiegelte Chat-Leserichtung der Teilnehmer-Ansicht. */
export async function SessionConversationCard({
  session,
}: {
  session: PlanSessionTranscript;
}) {
  const tm = await getTranslations("research.market");

  return (
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
  );
}
