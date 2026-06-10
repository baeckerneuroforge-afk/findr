import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { loadOrgSyntheses } from "@/lib/mission-control/engine";
import {
  countCompletedSessionsForPlans,
  listResearchPlans,
} from "@/lib/research/plans-service";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";
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
 *   • countCompletedSessionsForPlans — die §7-Fortschritts-Messung, seit
 *     Perf-Etappe D als EIN gebündelter Read über alle Studien (plan_id-only
 *     Projektion + JS-Gruppierung) statt N paralleler head-COUNTs. Lebt im
 *     selben Service direkt neben dem Einzel-Zähler der Detail-Seite mit
 *     identischem Prädikat-Satz — kein driftender Parallel-Datenpfad.
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

export default async function MarketResearchOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
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

  const t = await getTranslations("research.market");
  // Shared headings (columns + status labels) come from research.plans — the
  // two surfaces deliberately reuse the same vocabulary for the same concepts.
  const tp = await getTranslations("research.plans");
  const locale = await getLocale();

  // Scoped to market campaigns only — the discriminator does the separation.
  const plans = await listResearchPlans(orgId, "market_research");

  // E3 (Konsole-v5): Filter & Suche als URL-Parameter — server-gefiltert,
  // damit SSR-Ansicht, Reload und geteilte Links identisch bleiben. Die
  // KPIs zählen bewusst IMMER über alle Studien (stabile Übersicht), nur
  // die Liste filtert.
  const { status: rawStatus, q: rawQ } = await searchParams;
  const statusFilter: Status | null =
    rawStatus === "draft" ||
    rawStatus === "active" ||
    rawStatus === "completed" ||
    rawStatus === "archived"
      ? rawStatus
      : null;
  const q = (rawQ ?? "").trim();

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-display text-neutral-900">{t("indexTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("indexSubtitle")}</p>
      </div>
      {/* Primäraktion in der System-Primärfarbe (ui/Button-Sprache) statt des
          alten neutral-900-Sonderwegs — angeglichen an die Heute-Seite. */}
      <Link
        href="/dashboard/market-research/new"
        className="inline-flex h-8 items-center justify-center rounded-md bg-primary-600 px-3 text-body-strong font-medium text-white transition-colors hover:bg-primary-700"
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
        <AutoRefresh />
      </div>
    );
  }

  // Two READ-ONLY batches over EXISTING queries (no new backend, no migration),
  // run in parallel:
  //   • per-plan completed-interview counts — the canonical §7 counter, since
  //     Perf-Etappe D as ONE batched query for all plans (plan_id-only
  //     projection, JS grouping) instead of N parallel head-COUNTs. Fail-open:
  //     null map → "—" on every row, mirroring the old per-plan null.
  //   • org-wide synthesis set — ONE batch read. A plan is "synthesis ready" iff
  //     a study_synthesis row exists for it. Wrapped fail-open so a synthesis-
  //     read hiccup only blanks the decorative flag, never the page.
  const [completedCounts, synthesisPlanIds] = await Promise.all([
    countCompletedSessionsForPlans(
      orgId,
      plans.map((plan) => plan.id),
    ),
    loadOrgSyntheses(orgId)
      .then((rows) => new Set(rows.map((row) => row.studyId)))
      .catch(() => new Set<string>()),
  ]);

  // ── Kennzahlen ────────────────────────────────────────────────────────────
  const activeStudies = plans.filter((p) => p.status === "active").length;
  const synthesizedStudies = plans.filter((p) =>
    synthesisPlanIds.has(p.id),
  ).length;
  // Sum only the counts we actually know. The batched read is all-or-nothing:
  // null map → every plan shows "—" and the total falls back too, instead of
  // a misleading 0.
  const knownCounts = completedCounts ? [...completedCounts.values()] : [];
  const completedTotal = knownCounts.reduce((sum, c) => sum + c, 0);
  const completedDisplay: string | number =
    completedCounts === null ? t("poolCountUnknown") : completedTotal;

  const rows = plans.map((plan) => ({
    plan,
    completed: completedCounts?.get(plan.id) ?? null,
    hasSynthesis: synthesisPlanIds.has(plan.id),
  }));

  // Liste filtern (KPIs oben bleiben Gesamtwerte).
  const norm = q.toLowerCase();
  const filteredRows = rows.filter(({ plan }) => {
    if (statusFilter && plan.status !== statusFilter) return false;
    if (norm) {
      const hay = `${plan.title} ${plan.objective ?? ""}`.toLowerCase();
      if (!hay.includes(norm)) return false;
    }
    return true;
  });

  // Status-Chips: nur Status mit Treffern anbieten, Reihenfolge fix.
  const statusOrder: Status[] = ["active", "draft", "completed", "archived"];
  const statusCounts = new Map<Status, number>();
  for (const p of plans) {
    statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);
  }
  const chipHref = (s: Status | null) => {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/dashboard/market-research?${qs}` : "/dashboard/market-research";
  };
  const chipBase =
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-small transition-colors";
  const chipActive =
    "border-primary-200 bg-primary-50 font-medium text-primary-700";
  const chipIdle =
    "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900";

  return (
    <div className="space-y-8">
      <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
        {header}
      </div>

      {/* Kennzahlen-Headline — alles aus den schon geladenen Reads. */}
      <div
        className="st-rise grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        style={{ "--st": 1 } as React.CSSProperties}
      >
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
        <StatCard
          label={t("overviewStatSyntheses")}
          value={synthesizedStudies}
          subtitle={t("overviewStatSynthesesSub")}
          status={synthesizedStudies > 0 ? "primary" : "default"}
        />
      </div>

      {/* Filter-Zeile: Status-Chips als Links + Suche als GET-Form — beides
          rein server-seitig, kein Client-State. */}
      <div
        className="st-rise flex flex-wrap items-center gap-2"
        style={{ "--st": 2 } as React.CSSProperties}
      >
        <Link
          href={chipHref(null)}
          aria-current={statusFilter === null ? "true" : undefined}
          className={`${chipBase} ${statusFilter === null ? chipActive : chipIdle}`}
        >
          {t("filterAll")}
          <span className="font-mono text-caption text-neutral-400">
            {plans.length}
          </span>
        </Link>
        {statusOrder.map((s) => {
          const count = statusCounts.get(s) ?? 0;
          if (count === 0) return null;
          return (
            <Link
              key={s}
              href={chipHref(s)}
              aria-current={statusFilter === s ? "true" : undefined}
              className={`${chipBase} ${statusFilter === s ? chipActive : chipIdle}`}
            >
              {tp(`status.${s}`)}
              <span className="font-mono text-caption text-neutral-400">
                {count}
              </span>
            </Link>
          );
        })}
        <form
          action="/dashboard/market-research"
          method="get"
          className="ml-auto"
        >
          {statusFilter && (
            <input type="hidden" name="status" value={statusFilter} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className={`${FIELD_INPUT_CLASS} w-56`}
          />
        </form>
      </div>

      {/* Studien-Liste — Titel + Status + Themen + Ziel-Pool-Fortschritt + Synthese. */}
      <Card className="st-rise" style={{ "--st": 3 } as React.CSSProperties}>
        {filteredRows.length === 0 ? (
          <CardBody>
            <p className="text-small text-neutral-500">
              {t("filterNoMatch")}{" "}
              <Link
                href="/dashboard/market-research"
                className="font-medium text-primary-700 hover:text-primary-800"
              >
                {t("filterReset")}
              </Link>
            </p>
          </CardBody>
        ) : (
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
              {filteredRows.map(({ plan, completed, hasSynthesis }) => (
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
                  {/* Ziel-Pool-Fortschritt (§7): "47 von 200" mit Ziel + Balken,
                      sonst der reine Abschluss-Count, fail-open "—" bei
                      Zähl-Fehler. */}
                  <TD className="whitespace-nowrap text-right text-neutral-700">
                    {completed === null ? (
                      <span className="text-neutral-400">
                        {t("poolCountUnknown")}
                      </span>
                    ) : plan.sampleTarget !== null ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="font-mono text-small">
                          {t("poolProgress", {
                            completed,
                            target: plan.sampleTarget,
                          })}
                        </span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className={`h-full rounded-full ${
                              plan.status === "completed"
                                ? "bg-success-500"
                                : "bg-primary-600"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (completed / plan.sampleTarget) * 100,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
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
        )}
      </Card>

      {/* O6: stilles 30s-Polling — "47 von 200" und Synthese-Badges bleiben
          aktuell, Filter/Suche (URL-Parameter) überleben den Refresh. */}
      <AutoRefresh />
    </div>
  );
}
