import { getTranslations } from "next-intl/server";
import type {
  FeatureRequest,
  FeatureRequestCategory,
  IntensityLevel,
  PainPoint,
  PainPointCategory,
  Theme,
} from "@/lib/schemas/product-discovery";
import type { ProductDiscoveryInsightRecord } from "@/lib/product-discovery/service";

/**
 * Pure presentational panel for one call's Product Discovery insight.
 * Mirrors the visual weight of RiskSignalDrilldown / AccountHealthPanel
 * but adapted to extraction-only output (no aggregated score / level —
 * just the three layers the classifier produces: featureRequests,
 * painPoints, themes). Renders the verbatim evidence the prompt
 * mandates so the reader can audit each finding without leaving the
 * panel.
 *
 * Empty-result semantics matter here. The prompt's DO-NOT-DETECT rules
 * make 0/0/0 a frequent correct answer (sales-blocker calls, off-topic
 * conversations, pure HEALTH praise). When that happens we surface a
 * dezenter "no findings" hint with the summary as context, so the
 * reader sees the panel ran without thinking it broke silently.
 */

// English labels for category enums — match /dashboard/product-discovery
// (the rollup page) so the same vocabulary appears in both places. The
// keys are the SCREAMING_SNAKE_CASE enum values from
// src/lib/schemas/product-discovery.
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

const INTENSITY_BADGE: Record<IntensityLevel, string> = {
  blocker: "border-danger-500/30 bg-danger-50 text-danger-700",
  high: "border-primary-200 bg-primary-50 text-primary-700",
  medium: "border-neutral-200 bg-neutral-50 text-neutral-700",
  low: "border-neutral-200 bg-white text-neutral-500",
};

function formatAnalyzedAt(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("de-DE");
}

function ItemCard({
  categoryLabel,
  title,
  description,
  level,
  confidence,
  evidence,
}: {
  categoryLabel: string;
  title: string;
  description: string;
  level: IntensityLevel;
  confidence: number;
  evidence: string[];
}) {
  return (
    <li className="rounded-md border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-caption font-medium uppercase tracking-wider text-neutral-500">
          {categoryLabel}
        </span>
        <span
          className={`rounded-md border px-1.5 py-0.5 text-caption font-medium ${INTENSITY_BADGE[level]}`}
        >
          {level}
        </span>
        <span className="ml-auto text-caption text-neutral-400">
          {Math.round(confidence * 100)}%
        </span>
      </div>
      <p className="text-body-strong text-neutral-900">{title}</p>
      {description && (
        <p className="mt-1 text-small text-neutral-600">{description}</p>
      )}
      {evidence[0] && (
        <blockquote className="mt-2 border-l-2 border-neutral-200 pl-3 text-small italic text-neutral-600">
          „{evidence[0]}”
        </blockquote>
      )}
    </li>
  );
}

export async function ProductDiscoveryPanel({
  insight,
}: {
  insight: ProductDiscoveryInsightRecord;
}) {
  const t = await getTranslations("research.discovery");
  const featureRequests = insight.feature_requests;
  const painPoints = insight.pain_points;
  const themes = insight.themes;
  const total = featureRequests.length + painPoints.length;

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/50 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-h3 text-neutral-900">{t("panelTitle")}</h4>
        <span className="text-caption text-neutral-500">
          {total === 0
            ? t("panelNoFindings")
            : t("panelCounts", {
                fr: featureRequests.length,
                pp: painPoints.length,
                themes: themes.length,
              })}
          {" · "}
          {t("panelAnalyzed", { date: formatAnalyzedAt(insight.analyzed_at) })}
        </span>
      </div>

      {insight.summary && (
        <p className="text-body leading-relaxed text-neutral-700">
          {insight.summary}
        </p>
      )}

      {total === 0 ? (
        <p className="text-small italic text-neutral-500">{t("panelEmpty")}</p>
      ) : (
        <>
          {featureRequests.length > 0 && (
            <section>
              <h5 className="mb-2 text-caption font-medium uppercase tracking-wider text-neutral-500">
                {t("panelFrSection", { count: featureRequests.length })}
              </h5>
              <ul className="space-y-2">
                {featureRequests.map((fr: FeatureRequest, i) => (
                  <ItemCard
                    key={`fr-${i}`}
                    categoryLabel={
                      FEATURE_REQUEST_LABELS[fr.category] ?? fr.category
                    }
                    title={fr.title}
                    description={fr.description}
                    level={fr.intensity}
                    confidence={fr.confidence}
                    evidence={fr.evidence}
                  />
                ))}
              </ul>
            </section>
          )}

          {painPoints.length > 0 && (
            <section>
              <h5 className="mb-2 text-caption font-medium uppercase tracking-wider text-neutral-500">
                {t("panelPpSection", { count: painPoints.length })}
              </h5>
              <ul className="space-y-2">
                {painPoints.map((pp: PainPoint, i) => (
                  <ItemCard
                    key={`pp-${i}`}
                    categoryLabel={
                      PAIN_POINT_LABELS[pp.category] ?? pp.category
                    }
                    title={pp.title}
                    description={pp.description}
                    level={pp.severity}
                    confidence={pp.confidence}
                    evidence={pp.evidence}
                  />
                ))}
              </ul>
            </section>
          )}

          {themes.length > 0 && (
            <section>
              <h5 className="mb-2 text-caption font-medium uppercase tracking-wider text-neutral-500">
                {t("panelThemesSection", { count: themes.length })}
              </h5>
              <ul className="space-y-2">
                {themes.map((t: Theme, i) => (
                  <li
                    key={`th-${i}`}
                    className="rounded-md border border-neutral-200 bg-white p-3"
                  >
                    <p className="text-body-strong text-neutral-900">
                      {t.label}
                    </p>
                    <p className="mt-1 text-small text-neutral-600">
                      {t.summary}
                    </p>
                    <p className="mt-2 text-caption text-neutral-400">
                      FR=[{t.relatedFeatureRequestIndices.join(", ")}] · PP=[
                      {t.relatedPainPointIndices.join(", ")}]
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
