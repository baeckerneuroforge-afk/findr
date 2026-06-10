import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { ResearchPlanForm } from "@/components/dashboard/ResearchPlanForm";

/**
 * /dashboard/market-research/new — Markt-Kampagne anlegen (Phase M3).
 *
 * Mirror von /dashboard/research-plans/new — server-rendered shell + dieselbe
 * client-ResearchPlanForm, NUR mit studyType="market_research". Das ist der
 * einzige Unterschied beim Anlegen: die Form stempelt den Diskriminator und
 * redirected danach in den Markt-Bereich. Das Discovery-Anlegen
 * (research-plans/new, <ResearchPlanForm /> ohne Prop) bleibt byte-identisch.
 */

export default async function NewMarketCampaignPage() {
  try {
    await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      if (err.code === "no_auth") redirect("/sign-in");
      if (err.code === "no_org") redirect("/onboarding/create-org");
      redirect("/sign-in");
    }
    throw err;
  }

  const t = await getTranslations("research.market");

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2">
          <Link
            href="/dashboard/market-research"
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {t("backToCampaigns")}
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">{t("newTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("newSubtitle")}</p>
      </div>

      <ResearchPlanForm studyType="market_research" />
    </div>
  );
}
