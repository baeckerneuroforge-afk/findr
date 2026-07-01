import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { getOrgName, requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { getStudySynthesis } from "@/lib/synthesis/service";
import { buildSynthesisPdf } from "@/lib/pdf/synthesis-report";
import { resolveExportBranding } from "@/lib/settings/branding-assets";

/**
 * GET /api/research/plans/[id]/synthesis/pdf
 *
 * Streams a Klymeo-branded PDF of the Stage-2 synthesis for one plan. Mirrors
 * the auth/ownership pattern of /api/research/plans/[id]/synthesis (POST) —
 * requireOrgIdOrError → org-scoped getResearchPlan ownership check → fetch
 * the synthesis row → build PDF.
 *
 * Surface:
 *   401/403  — auth fail (via requireOrgIdOrError)
 *   404      — plan not found in this org, OR synthesis row missing /
 *              never been synthesized (synthesized_at is null)
 *   500      — PDF build threw (font load, pdfkit stream)
 *   200      — application/pdf body with Content-Disposition attachment
 *
 * Filename is the generic `klymeo-synthesis-YYYY-MM-DD.pdf`, mirroring the
 * existing forecast / loss-report routes; this stays robust against
 * special characters in plan titles (the synthesis is still uniquely
 * tied to its plan by the file content + the user's own context — the
 * filename is just a friendly download hint).
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

  // Ownership gate — same as POST /synthesis. A plan in another org returns
  // 404, not 403, so a probe can't distinguish "wrong org" from "no such
  // plan". Same posture as the other research routes.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const synthesis = await getStudySynthesis(orgId, planId);
  if (!synthesis || synthesis.synthesized_at === null) {
    // Either the row doesn't exist yet OR an empty slot is sitting there
    // unsynthesized. Both surface to the user as "no synthesis to download".
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
    const pdf = await buildSynthesisPdf({
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
        // Non-null by the guard above; TS doesn't narrow through the
        // boolean check on a property of a record we destructured. Cast
        // is safe at runtime.
        synthesized_at: synthesis.synthesized_at as string,
        model: synthesis.model,
        executive_narrative: synthesis.executive_narrative,
        implications: synthesis.implications,
      },
      orgName,
      locale,
      branding,
    });

    const date = new Date().toISOString().split("T")[0];
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="klymeo-synthesis-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(
      `[GET /api/research/plans/${planId}/synthesis/pdf] build failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("research.synthesisPdfFailed"),
      },
      { status: 500 },
    );
  }
}
