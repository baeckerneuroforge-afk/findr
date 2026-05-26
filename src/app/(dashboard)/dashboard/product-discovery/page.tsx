import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getLatestProductDiscoveryInsights } from "@/lib/product-discovery/insights-service";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Product Discovery Overview — the rollup page for Phase 3 of the AI brain.
 * Mirror of /dashboard/health: NO new AI calls, pure JS aggregation over the
 * latest stored Product Discovery insight per call. Surfaces what customers
 * are asking for, what hurts, and which themes recur across calls.
 *
 * Sections (top to bottom):
 *   1. KPI tiles  — calls analyzed, feature requests, pain points, blockers
 *   2. Feature Request categories  — frequency rollup with sample title
 *   3. Pain Point categories       — frequency rollup with sample title
 *   4. Top themes across calls     — naive label-grouped frequency
 *   5. Calls with most findings    — links to parent deal/account
 */

function DiscoveryIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" strokeLinecap="round" />
      <path d="m20 20-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

export default async function ProductDiscoveryOverviewPage() {
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

  const insights = await getLatestProductDiscoveryInsights(orgId);

  if (insights.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-display text-neutral-900">Product discovery</h1>
          <p className="mt-1 text-body text-neutral-500">
            A roll-up of feature requests, pain points and recurring themes
            across all analyzed customer calls.
          </p>
        </div>

        <EmptyState
          icon={<DiscoveryIcon />}
          title="No product-discovery insights yet"
          description="Findr extracts feature requests, pain points and recurring themes from each analyzed transcript. As soon as the first call is processed, this rollup populates automatically."
          cta={{ label: "Go to deals", href: "/dashboard/deals" }}
        />
      </div>
    );
  }

  // Aggregations land in the next step.
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display text-neutral-900">Product discovery</h1>
        <p className="mt-1 text-body text-neutral-500">
          A roll-up across{" "}
          {insights.length === 1 ? "1 analyzed call" : `${insights.length} analyzed calls`}.
        </p>
      </div>
    </div>
  );
}
