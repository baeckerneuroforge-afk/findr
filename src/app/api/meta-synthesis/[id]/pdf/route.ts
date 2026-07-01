import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { getOrgName, requireOrgIdOrError } from "@/lib/auth/org";
import { getMetaSynthesis } from "@/lib/meta-synthesis/service";
import { buildMetaSynthesisPdf } from "@/lib/pdf/meta-synthesis-report";
import { resolveExportBranding } from "@/lib/settings/branding-assets";

/**
 * GET /api/meta-synthesis/[id]/pdf — Klymeo-branded PDF of a meta-synthesis.
 *
 * Mirrors the single-study synthesis PDF route: requireOrgIdOrError →
 * org-scoped getMetaSynthesis (null cross-org, so no existence leak) → build.
 *
 * Surface:
 *   401/403  — auth fail
 *   404      — artifact not found in this org
 *   500      — PDF build threw
 *   200      — application/pdf attachment
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const resolvedLocale = await getLocale();
  const locale: Locale = isLocale(resolvedLocale) ? resolvedLocale : DEFAULT_LOCALE;
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id } = await params;
  const record = await getMetaSynthesis(orgId, id);
  if (!record) {
    return NextResponse.json({ error: t("unexpected") }, { status: 404 });
  }

  try {
    // Unabhängige Reads parallel statt zwei serielle Stufen vor dem Build.
    const [orgName, branding] = await Promise.all([
      getOrgName(orgId),
      resolveExportBranding(orgId),
    ]);
    const pdf = await buildMetaSynthesisPdf({
      title: record.title,
      createdAt: record.createdAt,
      model: record.model,
      totalStudies: record.basedOn.length,
      totalInterviews: record.basedOn.reduce((n, s) => n + s.basedOnCount, 0),
      studies: record.basedOn.map((s) => ({
        studyId: s.studyId,
        studyTitle: s.studyTitle,
        basedOnCount: s.basedOnCount,
      })),
      result: record.result,
      orgName,
      locale,
      branding,
    });

    const date = new Date().toISOString().split("T")[0];
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="klymeo-meta-synthesis-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(
      `[GET /api/meta-synthesis/${id}/pdf] build failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: t("unexpected") }, { status: 500 });
  }
}
