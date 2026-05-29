import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getDealById } from "@/lib/deals/service";
import { getDealInterview } from "@/lib/voice-agent/session-service";
import { buildInterviewReportPdf } from "@/lib/pdf/interview-report";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";

/**
 * Download the "Post-Loss Interview Report" PDF for a deal's completed interview.
 * Org-internal (logged-in dashboard user) — NOT the public token path. Mirrors
 * the solution-layer PDF route (same Geist-embedded generator, same deploy
 * font-tracing protection in next.config).
 */

const DealIdSchema = z.string().uuid();

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "deal"
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const resolvedLocale = await getLocale();
  const locale: Locale = isLocale(resolvedLocale)
    ? resolvedLocale
    : DEFAULT_LOCALE;
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  const { id } = await params;
  const parsed = DealIdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: t("solution.invalidDealId") }, { status: 400 });
  }
  const dealId = parsed.data;

  try {
    const deal = await getDealById(orgId, dealId);
    if (!deal) {
      return NextResponse.json({ error: t("notFound.deal") }, { status: 404 });
    }

    const interview = await getDealInterview(orgId, dealId);
    if (!interview || interview.status !== "completed") {
      return NextResponse.json(
        { error: t("deals.noCompletedInterview") },
        { status: 404 },
      );
    }

    const pdf = await buildInterviewReportPdf({
      locale,
      deal: {
        name: deal.name,
        company: deal.companyName,
        stage: deal.stage,
        amount: deal.amount,
        currency: deal.currency,
        contactName: deal.contactName,
        contactEmail: deal.contactEmail,
        contactPhone: deal.contactPhone,
      },
      interview: {
        extractedReason: interview.extractedReason,
        evidence: interview.evidence,
        matchedRiskPrediction: interview.matchedRiskPrediction,
        reasoning: interview.reasoning,
        conversation: interview.conversation,
        createdAt: interview.createdAt,
        completedAt: interview.completedAt,
      },
    });

    const date = (
      interview.completedAt ||
      interview.createdAt ||
      new Date().toISOString()
    ).split("T")[0];
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="findr-loss-report-${slug(
          deal.companyName || deal.name,
        )}-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(`[deals/${dealId}/interview/pdf] failed:`, err);
    return NextResponse.json(
      {
        error: t("deals.interviewPdfFailed"),
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
