import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { loadOrgSyntheses } from "@/lib/mission-control/engine";
import {
  countCompletedSessionsForPlan,
  listResearchPlans,
} from "@/lib/research/plans-service";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

/**
 * /dashboard/market-research — Markt-Übersicht (MR-Trennung E2).
 *
 * Eigener BEREICH, DIESELBE Engine. E2 macht aus der dünnen Studien-Liste eine
 * echte Übersicht: eine Kennzahlen-Headline + eine reichere Studien-Liste mit
 * Ziel-Pool-Fortschritt ("47 von 200") und Synthese-fertig-Flag.
 *
 * STRENG ADDITIV: jede Zahl kommt aus einer SCHON existierenden, org-scoped
 * Read-Funktion — KEINE Migration, KEIN neues Backend, die geteilte Engine wird
 * NICHT angefasst. Es werden nur drei vorhandene Reads zusammengestellt:
 *   • listResearchPlans(orgId, "market_research") — die Studien (1 Read, der
 *     Diskriminator scopt auf den Markt-Bereich).
 *   • countCompletedSessionsForPlan — die §7-Fortschritts-Messung pro Studie,
 *     der byte-genaue Zähler der Detail-Seite (head:true COUNT, 0 Zeilen-
 *     Transfer, fail-open null → "—"). Per Promise.all parallel über die Pläne;
 *     bewusst KEIN zweiter, gebündelter Zähl-Pfad (kein paralleler Datenpfad,
 *     der von der Detail-Seite driften könnte) — N = Anzahl Markt-Studien ist
 *     klein, und jeder Aufruf transferiert null Zeilen.
 *   • loadOrgSyntheses(orgId) — EIN org-weiter Batch-Read; eine Studie gilt als
 *     "Synthese bereit", wenn dafür eine study_synthesis-Zeile existiert.
 *     Defensiv fail-open umschlossen: ein Synthese-Lesefehler degradiert nur das
 *     Flag, nie die Seite.
 *
 * "Letzte Aktivität" bleibt bewusst WEG: research_plans hat kein updated_at und
 * es gibt keine vorhandene Quelle dafür — nichts wird erfunden, keine Migration
 * dafür angelegt.
 *
 * Die Product-Discovery-Übersichts-Seite (/dashboard/product-discovery) bleibt
 * unverändert; diese Seite spiegelt nur deren Kennzahlen-Muster (StatCard-Grid).
 */

type Status = "draft" | "active" | "completed" | "archived";

const STATUS_VARIANT: Record<Status, BadgeVariant> = {
  draft: "default",
  active: "success",
  completed: "low",
  archived: "default",
};

function MarketIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13h2l2-7 3 14 3-11 2 4h6"
      />
    </svg>
  );
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function MarketResearchOverviewPage() {
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

  const t = await getTranslations("research.market");
  // Shared headings (columns + status labels) come from research.plans — the
  // two surfaces deliberately reuse the same vocabulary for the same concepts.
  const tp = await getTranslations("research.plans");
  const locale = await getLocale();

  // Scoped to market campaigns only — the discriminator does the separation.
  const plans = await listResearchPlans(orgId, "market_research");

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-display text-neutral-900">{t("indexTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("indexSubtitle")}</p>
      </div>
      <Link
        href="/dashboard/market-research/new"
        className="inline-flex h-8 items-center justify-center rounded-md bg-neutral-900 px-3 text-body-strong font-medium text-white transition-colors hover:bg-neutral-700"
      >
        {t("newCampaign")}
      </Link>
    </div>
  );

  // No campaigns yet → the area's empty state, nothing else to read.
  if (plans.length === 0) {
    return (
      <div className="space-y-8">
        {header}
        <EmptyState
          icon={<MarketIcon />}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          cta={{ label: t("emptyCta"), href: "/dashboard/market-research/new" }}
        />
      </div>
    );
  }

  // Two READ-ONLY batches over EXISTING queries (no new backend, no migration),
  // run in parallel:
  //   • per-plan completed-interview counts — the canonical §7 counter; each is
  //     a head:true COUNT (zero rows transferred) and fail-open (null → "—").
  //     Promise.all keeps the small N of COUNTs concurrent and reuses the detail
  //     page's exact semantics instead of forking a second counting path.
  //   • org-wide synthesis set — ONE batch read. A plan is "synthesis ready" iff
  //     a study_synthesis row exists for it. Wrapped fail-open so a synthesis-
  //     read hiccup only blanks the decorative flag, never the page.
  const [completedCounts, synthesisPlanIds] = await Promise.all([
    Promise.all(
      plans.map((plan) => countCompletedSessionsForPlan(orgId, plan.id)),
    ),
    loadOrgSyntheses(orgId)
      .then((rows) => new Set(rows.map((row) => row.studyId)))
      .catch(() => new Set<string>()),
  ]);

  // ── Kennzahlen ────────────────────────────────────────────────────────────
  const activeStudies = plans.filter((p) => p.status === "active").length;
  // Sum only the counts we actually know. A per-plan null is fail-open ("—");
  // if EVERY count failed we show "—" for the total instead of a misleading 0.
  // A partial failure shows a known lower bound — the honest fail-open value.
  const knownCounts = completedCounts.filter((c): c is number => c !== null);
  const completedTotal = knownCounts.reduce((sum, c) => sum + c, 0);
  const completedDisplay: string | number =
    knownCounts.length === 0 ? t("poolCountUnknown") : completedTotal;

  // Zip the parallel reads back onto their plans (Promise.all preserves order).
  const rows = plans.map((plan, i) => ({
    plan,
    completed: completedCounts[i],
    hasSynthesis: synthesisPlanIds.has(plan.id),
  }));

  return (
    <div className="space-y-8">
      {header}

      {/* Kennzahlen-Headline — alles aus den schon geladenen Reads. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("overviewStatStudies")} value={plans.length} />
        <StatCard
          label={t("overviewStatActive")}
          value={activeStudies}
          status={activeStudies > 0 ? "success" : "default"}
        />
        <StatCard
          label={t("overviewStatCompletes")}
          value={completedDisplay}
          subtitle={t("overviewStatCompletesSub")}
        />
      </div>

      {/* Studien-Liste — Titel + Status + Themen + Ziel-Pool-Fortschritt + Synthese. */}
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>{tp("colTitle")}</TH>
              <TH>{tp("colStatus")}</TH>
              <TH className="text-right">{tp("colTopics")}</TH>
              <TH className="text-right">{t("colProgress")}</TH>
              <TH>{t("colSynthesis")}</TH>
              <TH>{tp("colCreated")}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map(({ plan, completed, hasSynthesis }) => (
              <TR key={plan.id}>
                <TD>
                  <Link
                    href={`/dashboard/market-research/${plan.id}`}
                    className="text-body-strong text-neutral-900 hover:text-primary-700 hover:underline"
                  >
                    {plan.title}
                  </Link>
                  {plan.objective && (
                    <div className="mt-0.5 line-clamp-1 text-small text-neutral-500">
                      {plan.objective}
                    </div>
                  )}
                </TD>
                <TD>
                  <Badge variant={STATUS_VARIANT[plan.status]}>
                    {tp(`status.${plan.status}`)}
                  </Badge>
                </TD>
                <TD className="text-right text-neutral-700">
                  {plan.topics.length}
                </TD>
                {/* Ziel-Pool-Fortschritt (§7): "47 von 200" mit Ziel, sonst der
                    reine Abschluss-Count, fail-open "—" bei Zähl-Fehler. */}
                <TD className="whitespace-nowrap text-right text-neutral-700">
                  {completed === null ? (
                    <span className="text-neutral-400">
                      {t("poolCountUnknown")}
                    </span>
                  ) : plan.sampleTarget !== null ? (
                    t("poolProgress", {
                      completed,
                      target: plan.sampleTarget,
                    })
                  ) : (
                    completed
                  )}
                </TD>
                <TD>
                  {hasSynthesis ? (
                    <Badge variant="success">{t("synthesisReady")}</Badge>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </TD>
                <TD className="whitespace-nowrap text-neutral-700">
                  {formatDate(plan.createdAt, locale)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
