import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { getOrgName, requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { getStudySynthesis } from "@/lib/synthesis/service";
import { buildSynthesisPptx } from "@/lib/pptx/synthesis-deck";
import { resolveExportBranding } from "@/lib/settings/branding-assets";

/**
 * GET /api/research/plans/[id]/synthesis/pptx
 *
 * Streams a Findr-branded PowerPoint (.pptx) of the Stage-2 synthesis for one
 * plan. Second shareout format next to /synthesis/pdf — SAME auth, ownership,
 * gating and data path as that route; the only difference is buildSynthesisPptx
 * instead of buildSynthesisPdf. No parallel aggregation or re-fetch.
 *
 * Surface mirrors the PDF route:
 *   401/403  — auth fail (via requireOrgIdOrError)
 *   404      — plan not found in this org, OR synthesis row missing /
 *              never synthesized (synthesized_at is null)
 *   500      — deck build threw
 *   200      — pptx body with Content-Disposition attachment
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const resolvedLocale = await getLocale();
  const locale: Locale = isLocale(resolvedLocale)
    ? resolvedLocale
    : DEFAULT_LOCALE;
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const synthesis = await getStudySynthesis(orgId, planId);
  if (!synthesis || synthesis.synthesized_at === null) {
    return NextResponse.json(
      {
        error:
          t("research.noSynthesisYet"),
      },
      { status: 404 },
    );
  }

  try {
    const orgName = await getOrgName(orgId);
    const branding = await resolveExportBranding(orgId);
    const deck = await buildSynthesisPptx({
      plan: {
        title: plan.title,
        objective: plan.objective,
        persona: plan.persona,
      },
      synthesis: {
        overview: synthesis.overview,
        emergent_themes: synthesis.emergent_themes,
        tensions: synthesis.tensions,
        based_on_count: synthesis.based_on_count,
        synthesized_at: synthesis.synthesized_at as string,
        model: synthesis.model,
      },
      orgName,
      locale,
      branding,
    });

    const date = new Date().toISOString().split("T")[0];
    return new NextResponse(new Uint8Array(deck), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="findr-synthesis-${date}.pptx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(
      `[GET /api/research/plans/${planId}/synthesis/pptx] build failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("research.synthesisPptxFailed"),
      },
      { status: 500 },
    );
  }
}
