import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { listResearchPlans } from "@/lib/research/plans-service";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

/**
 * /dashboard/market-research — Markt-Kampagnen-Index (Phase M3).
 *
 * Eigener BEREICH, DIESELBE Engine: ein Klon-in-Geist von
 * /dashboard/research-plans, nur auf study_type='market_research' gescoped
 * (listResearchPlans mit Filter) und campaign-geframt. KEINE neue Tabelle,
 * KEIN zweiter Pfad — die Studien sind weitere research_plans-Zeilen, der
 * Diskriminator trennt nur die Linse (separation plan §5 M3).
 *
 * Bewusst OHNE BridgeSuggestionsPanel: die churn-getriebenen Brücken-Vorschläge
 * sind INTERNE Kunden-Studien (§9 #3) und gehören auf die Product-Discovery-
 * Research-Seite, nicht in den Markt-Bereich.
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

export default async function MarketResearchIndexPage() {
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

  return (
    <div className="space-y-8">
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

      {plans.length === 0 ? (
        <EmptyState
          icon={<MarketIcon />}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          cta={{ label: t("emptyCta"), href: "/dashboard/market-research/new" }}
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>{tp("colTitle")}</TH>
                <TH>{tp("colStatus")}</TH>
                <TH className="text-right">{tp("colTopics")}</TH>
                <TH className="text-right">{tp("colSampleTarget")}</TH>
                <TH>{tp("colCreated")}</TH>
              </TR>
            </THead>
            <TBody>
              {plans.map((plan) => (
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
                  <TD className="text-right text-neutral-700">
                    {plan.sampleTarget ?? "—"}
                  </TD>
                  <TD className="text-neutral-700 whitespace-nowrap">
                    {formatDate(plan.createdAt, locale)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
