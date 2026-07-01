import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { getOrgName, requireOrgIdOrError } from "@/lib/auth/org";
import { getMetaSynthesis } from "@/lib/meta-synthesis/service";
import { buildMetaSynthesisPptx } from "@/lib/pptx/meta-synthesis-deck";
import { resolveExportBranding } from "@/lib/settings/branding-assets";

/**
 * GET /api/meta-synthesis/[id]/pptx — Klymeo-branded PowerPoint of a
 * meta-synthesis. Mirrors the PDF route exactly (auth + org-scoped read + build),
 * only the builder + content-type differ.
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
    const orgName = await getOrgName(orgId);
    const branding = await resolveExportBranding(orgId);
    const pptx = await buildMetaSynthesisPptx({
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
    return new NextResponse(new Uint8Array(pptx), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="klymeo-meta-synthesis-${date}.pptx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(
      `[GET /api/meta-synthesis/${id}/pptx] build failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: t("unexpected") }, { status: 500 });
  }
}
