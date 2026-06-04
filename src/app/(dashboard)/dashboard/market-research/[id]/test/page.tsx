import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { getLatestSyntheticTestRun } from "@/lib/synthetic/service";
import { SyntheticTestPanel } from "@/components/dashboard/SyntheticTestPanel";
import { ENABLED_MODULES } from "@/config/modules";

/**
 * /dashboard/market-research/[id]/test — Trockenlauf (synthetic dry-run, Stufe 1).
 *
 * A focused, self-contained sub-experience (mirrors how the discovery side keeps
 * /synthesis as its own nested route rather than inline). Mirrors the campaign
 * detail page's auth + plan-load + study_type guard EXACTLY: a non-market plan
 * reaching this market-scoped route is redirected to the discovery side.
 *
 * Strict separation lives entirely server-side: the panel only ever talks to the
 * synthetic-test API, which writes ONLY the synthetic_test_* tables — never
 * interview_sessions / calls / product_discovery_insights / study_synthesis. So a
 * dry-run cannot move the "47 von 200" counter or appear in the real
 * synthesis / cross-study / insights.
 */
export default async function MarketStudyDryRunPage({
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

  const t = await getTranslations("syntheticTest");

  const { id: planId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) notFound();

  // Symmetric guard to the campaign detail page: this is the Market-Research
  // experience only. A discovery plan reached here belongs on the discovery side.
  if (plan.studyType !== "market_research") {
    if (!ENABLED_MODULES.productDiscovery) redirect("/dashboard");
    redirect(`/dashboard/research-plans/${planId}`);
  }

  const initialRun = await getLatestSyntheticTestRun(orgId, planId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2">
          <Link
            href={`/dashboard/market-research/${planId}`}
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {t("backToCampaign")}
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">{t("pageTitle")}</h1>
        <p className="mt-1 max-w-2xl text-body text-neutral-500">
          {t("pageSubtitle")}
        </p>
        <p className="mt-2 text-small text-neutral-400">{plan.title}</p>
      </div>

      <SyntheticTestPanel planId={plan.id} initialRun={initialRun} />
    </div>
  );
}
