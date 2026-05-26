import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import {
  getAllInsightsForOrg,
  type ProductDiscoveryInsightRecord,
} from "@/lib/product-discovery/service";
import {
  FEATURE_REQUEST_CATEGORIES,
  PAIN_POINT_CATEGORIES,
  type FeatureRequestCategory,
  type PainPointCategory,
} from "@/lib/schemas/product-discovery";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

// ── Label maps (UI-friendly versions of the SCREAMING_SNAKE_CASE enums) ────

const FEATURE_REQUEST_LABELS: Record<FeatureRequestCategory, string> = {
  NEW_CAPABILITY: "New capability",
  ENHANCEMENT: "Enhancement",
  INTEGRATION: "Integration",
  UI_UX: "UI / UX",
  AUTOMATION: "Automation",
  REPORTING: "Reporting",
  PERFORMANCE: "Performance",
  MOBILE: "Mobile",
  API: "API",
};

const PAIN_POINT_LABELS: Record<PainPointCategory, string> = {
  BUG: "Bug",
  MISSING_FEATURE: "Missing feature",
  UX_FRICTION: "UX friction",
  PERFORMANCE_ISSUE: "Performance",
  RELIABILITY: "Reliability",
  ONBOARDING: "Onboarding",
  DATA_QUALITY: "Data quality",
  INTEGRATION_GAP: "Integration gap",
  SUPPORT: "Support",
};

// ── Aggregation helpers ────────────────────────────────────────────────────

interface CategoryRollup<C extends string> {
  category: C;
  count: number;
  blockerCount: number;
  /** Title of the highest-confidence item in this category, if any. */
  sampleTitle: string | null;
  /** source_label of that same item, for attribution. */
  sampleSource: string | null;
}

interface CategorySeed {
  count: number;
  blockerCount: number;
  bestConfidence: number;
  sampleTitle: string | null;
  sampleSource: string | null;
}

function emptySeed(): CategorySeed {
  return {
    count: 0,
    blockerCount: 0,
    bestConfidence: -1,
    sampleTitle: null,
    sampleSource: null,
  };
}

function rollupFeatureRequestCategories(
  insights: ProductDiscoveryInsightRecord[],
): CategoryRollup<FeatureRequestCategory>[] {
  const seed = new Map<FeatureRequestCategory, CategorySeed>(
    FEATURE_REQUEST_CATEGORIES.map((c) => [c, emptySeed()]),
  );

  for (const insight of insights) {
    for (const fr of insight.feature_requests) {
      const entry = seed.get(fr.category);
      if (!entry) continue;
      entry.count += 1;
      if (fr.intensity === "blocker") entry.blockerCount += 1;
      if (fr.confidence > entry.bestConfidence) {
        entry.bestConfidence = fr.confidence;
        entry.sampleTitle = fr.title;
        entry.sampleSource = insight.source_label;
      }
    }
  }

  return FEATURE_REQUEST_CATEGORIES.map((category): CategoryRollup<FeatureRequestCategory> => {
    const entry = seed.get(category)!;
    return {
      category,
      count: entry.count,
      blockerCount: entry.blockerCount,
      sampleTitle: entry.sampleTitle,
      sampleSource: entry.sampleSource,
    };
  }).sort((a, b) => b.count - a.count);
}

function rollupPainPointCategories(
  insights: ProductDiscoveryInsightRecord[],
): CategoryRollup<PainPointCategory>[] {
  const seed = new Map<PainPointCategory, CategorySeed>(
    PAIN_POINT_CATEGORIES.map((c) => [c, emptySeed()]),
  );

  for (const insight of insights) {
    for (const pp of insight.pain_points) {
      const entry = seed.get(pp.category);
      if (!entry) continue;
      entry.count += 1;
      if (pp.severity === "blocker") entry.blockerCount += 1;
      if (pp.confidence > entry.bestConfidence) {
        entry.bestConfidence = pp.confidence;
        entry.sampleTitle = pp.title;
        entry.sampleSource = insight.source_label;
      }
    }
  }

  return PAIN_POINT_CATEGORIES.map((category): CategoryRollup<PainPointCategory> => {
    const entry = seed.get(category)!;
    return {
      category,
      count: entry.count,
      blockerCount: entry.blockerCount,
      sampleTitle: entry.sampleTitle,
      sampleSource: entry.sampleSource,
    };
  }).sort((a, b) => b.count - a.count);
}

// ── Themes (naive label clustering) ────────────────────────────────────────
// Themes are free-form labels per call. True semantic clustering would need
// an LLM; here we just group by case-folded label as a deterministic
// pre-stage. Hint in the section copy that smarter clustering is Phase 3.3.

interface ThemeRollup {
  /** First display label seen for this normalized key. */
  displayLabel: string;
  count: number;
  /** Summary of the first occurrence — gives the reader a concrete handle. */
  sampleSummary: string;
  /** Null when the underlying call's source_label could not be resolved
   *  (legacy non-UUID deal_id with no matching deals row, or a deleted
   *  parent). Rendered as a placeholder. */
  sampleSource: string | null;
  /** Total number of items the underlying themes reference. */
  totalLinkedItems: number;
}

function rollupThemes(insights: ProductDiscoveryInsightRecord[]): ThemeRollup[] {
  const buckets = new Map<string, ThemeRollup>();
  for (const insight of insights) {
    for (const theme of insight.themes) {
      const key = theme.label.trim().toLowerCase();
      const linked =
        theme.relatedFeatureRequestIndices.length +
        theme.relatedPainPointIndices.length;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalLinkedItems += linked;
      } else {
        buckets.set(key, {
          displayLabel: theme.label,
          count: 1,
          sampleSummary: theme.summary,
          sampleSource: insight.source_label,
          totalLinkedItems: linked,
        });
      }
    }
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.count - a.count || b.totalLinkedItems - a.totalLinkedItems)
    .slice(0, 6);
}

// ── Calls with most findings ───────────────────────────────────────────────

interface CallRow {
  insight: ProductDiscoveryInsightRecord;
  featureRequestCount: number;
  painPointCount: number;
  findingCount: number;
  /** Highest-severity blocker title across both FR and PP, if any. */
  topBlockerTitle: string | null;
}

function topCalls(insights: ProductDiscoveryInsightRecord[]): CallRow[] {
  return insights
    .map((insight): CallRow => {
      const featureRequestCount = insight.feature_requests.length;
      const painPointCount = insight.pain_points.length;
      const blockerFr = insight.feature_requests
        .filter((fr) => fr.intensity === "blocker")
        .sort((a, b) => b.confidence - a.confidence)[0];
      const blockerPp = insight.pain_points
        .filter((pp) => pp.severity === "blocker")
        .sort((a, b) => b.confidence - a.confidence)[0];
      const topBlockerTitle =
        (blockerPp?.confidence ?? -1) >= (blockerFr?.confidence ?? -1)
          ? (blockerPp?.title ?? blockerFr?.title ?? null)
          : (blockerFr?.title ?? blockerPp?.title ?? null);
      return {
        insight,
        featureRequestCount,
        painPointCount,
        findingCount: featureRequestCount + painPointCount,
        topBlockerTitle,
      };
    })
    .filter((row) => row.findingCount > 0)
    .sort(
      (a, b) =>
        b.findingCount - a.findingCount ||
        Date.parse(b.insight.analyzed_at) - Date.parse(a.insight.analyzed_at),
    )
    .slice(0, 10);
}

function sourceHref(insight: ProductDiscoveryInsightRecord): string | null {
  if (insight.source_kind === "deal" && insight.deal_id) {
    return `/dashboard/deals/${insight.deal_id}`;
  }
  if (insight.source_kind === "account" && insight.account_id) {
    return `/dashboard/accounts/${insight.account_id}`;
  }
  return null;
}

function formatAnalyzedAt(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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

  const insights = await getAllInsightsForOrg(orgId);

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

  // ── KPI counters ────────────────────────────────────────────────────────
  let featureRequestTotal = 0;
  let painPointTotal = 0;
  let blockerTotal = 0;
  for (const insight of insights) {
    featureRequestTotal += insight.feature_requests.length;
    painPointTotal += insight.pain_points.length;
    for (const fr of insight.feature_requests) {
      if (fr.intensity === "blocker") blockerTotal += 1;
    }
    for (const pp of insight.pain_points) {
      if (pp.severity === "blocker") blockerTotal += 1;
    }
  }

  const featureRequestRollup = rollupFeatureRequestCategories(insights);
  const painPointRollup = rollupPainPointCategories(insights);
  const themes = rollupThemes(insights);
  const calls = topCalls(insights);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-display text-neutral-900">Product discovery</h1>
        <p className="mt-1 text-body text-neutral-500">
          A roll-up across{" "}
          {insights.length === 1 ? "1 analyzed call" : `${insights.length} analyzed calls`}
          .
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Calls analyzed" value={insights.length} />
        <StatCard label="Feature requests" value={featureRequestTotal} />
        <StatCard
          label="Pain points"
          value={painPointTotal}
          status={painPointTotal > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Blockers"
          value={blockerTotal}
          subtitle="Items flagged blocker"
          status={blockerTotal > 0 ? "critical" : "default"}
        />
      </div>

      {/* Feature requests by category */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">Feature requests by category</h2>
          <p className="text-body text-neutral-500">
            Frequency across all analyzed calls, with the highest-confidence
            example from each category.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featureRequestRollup.map((row) => (
            <CategoryCard
              key={row.category}
              label={FEATURE_REQUEST_LABELS[row.category]}
              row={row}
              totalCalls={insights.length}
            />
          ))}
        </div>
      </section>

      {/* Pain points by category */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">Pain points by category</h2>
          <p className="text-body text-neutral-500">
            What hurts most — frequency across calls with the highest-confidence
            example from each category.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {painPointRollup.map((row) => (
            <CategoryCard
              key={row.category}
              label={PAIN_POINT_LABELS[row.category]}
              row={row}
              totalCalls={insights.length}
            />
          ))}
        </div>
      </section>

      {/* Top themes */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">Top themes</h2>
          <p className="text-body text-neutral-500">
            Themes recur across calls. Grouped by exact label match — semantic
            clustering follows in Phase 3.3.
          </p>
        </div>
        {themes.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-4 text-center text-body text-neutral-500">
                No themes emerged across the analyzed calls yet.
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {themes.map((theme) => (
              <Card key={theme.displayLabel.toLowerCase()}>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-h3 text-neutral-900">
                        {theme.displayLabel}
                      </div>
                      <div className="text-small text-neutral-500">
                        {theme.count} {theme.count === 1 ? "call" : "calls"}
                        {theme.totalLinkedItems > 0
                          ? ` · ${theme.totalLinkedItems} linked ${
                              theme.totalLinkedItems === 1 ? "item" : "items"
                            }`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                      Sample{theme.sampleSource ? ` — ${theme.sampleSource}` : ""}
                    </div>
                    <blockquote className="border-l-2 border-neutral-200 pl-3 text-small text-neutral-600">
                      {theme.sampleSummary}
                    </blockquote>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Calls with most findings */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">Calls with most findings</h2>
          <p className="text-body text-neutral-500">
            Top 10 analyzed calls by combined feature-request and pain-point
            count. Links open the parent deal or account.
          </p>
        </div>
        {calls.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-4 text-center text-body text-neutral-500">
                No findings extracted across the analyzed calls yet.
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Source</TH>
                  <TH className="text-right">Findings</TH>
                  <TH>Top blocker</TH>
                  <TH>Analyzed</TH>
                </TR>
              </THead>
              <TBody>
                {calls.map((row) => {
                  const href = sourceHref(row.insight);
                  const kindLabel =
                    row.insight.source_kind === "deal" ? "Deal" : "Account";
                  return (
                    <TR key={row.insight.id}>
                      <TD>
                        {href ? (
                          <Link
                            href={href}
                            className="text-body-strong text-neutral-900 hover:text-primary-700 hover:underline"
                          >
                            {row.insight.source_label ?? "—"}
                          </Link>
                        ) : (
                          <span className="text-body-strong text-neutral-900">
                            {row.insight.source_label ?? "—"}
                          </span>
                        )}
                        <div className="text-caption uppercase tracking-wider text-neutral-400">
                          {kindLabel}
                        </div>
                      </TD>
                      <TD className="text-right whitespace-nowrap font-medium text-neutral-900">
                        {row.findingCount}
                        <span className="ml-2 text-small font-normal text-neutral-500">
                          {row.featureRequestCount} FR · {row.painPointCount} PP
                        </span>
                      </TD>
                      <TD className="text-neutral-700">
                        {row.topBlockerTitle ?? (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TD>
                      <TD className="text-neutral-700 whitespace-nowrap">
                        {formatAnalyzedAt(row.insight.analyzed_at)}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}

// ── CategoryCard ────────────────────────────────────────────────────────────
// Shared between feature-request and pain-point rollups in the next step.

function CategoryCard<C extends string>({
  label,
  row,
  totalCalls,
}: {
  label: string;
  row: CategoryRollup<C>;
  totalCalls: number;
}) {
  const empty = row.count === 0;
  const sharePct = totalCalls > 0 ? (row.count / totalCalls) * 100 : 0;
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={`text-h3 ${empty ? "text-neutral-400" : "text-neutral-900"}`}>
              {label}
            </div>
            <div className="text-small text-neutral-500">
              {row.count === 0
                ? "No mentions yet"
                : `${row.count} ${row.count === 1 ? "mention" : "mentions"}`}
              {row.count > 0 && totalCalls > 0
                ? ` · ${sharePct.toFixed(0)}% of calls`
                : ""}
            </div>
          </div>
          {row.blockerCount > 0 && (
            <Badge variant="critical">
              {row.blockerCount} {row.blockerCount === 1 ? "blocker" : "blockers"}
            </Badge>
          )}
        </div>
        {row.sampleTitle && (
          <div className="space-y-1">
            <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
              Sample{row.sampleSource ? ` — ${row.sampleSource}` : ""}
            </div>
            <blockquote className="border-l-2 border-neutral-200 pl-3 text-small text-neutral-600">
              {row.sampleTitle}
            </blockquote>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
