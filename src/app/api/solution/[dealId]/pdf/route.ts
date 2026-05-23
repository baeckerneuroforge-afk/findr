import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getDealById } from "@/lib/deals/service";
import { getCallsByDealId } from "@/lib/calls/service";
import { getLatestRiskScore } from "@/lib/risk/service";
import { getSolutionReports } from "@/lib/solution/service";
import { buildSolutionReportPdf } from "@/lib/pdf/solution-report";

const DealIdSchema = z.string().uuid();

function formatCallTitle(callType: string | null): string {
  if (!callType || !callType.trim()) return "Sales call";
  return callType
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

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
  { params }: { params: Promise<{ dealId: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  const { dealId } = await params;
  const parsed = DealIdSchema.safeParse(dealId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dealId" }, { status: 400 });
  }
  const id = parsed.data;

  try {
    const deal = await getDealById(orgId, id);
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const reports = await getSolutionReports(orgId, id, 1);
    const report = reports[0];
    if (!report) {
      return NextResponse.json(
        { error: "No solution report for this deal yet." },
        { status: 404 },
      );
    }

    const [risk, calls] = await Promise.all([
      getLatestRiskScore(orgId, id),
      getCallsByDealId(orgId, id),
    ]);
    const latestCall = calls[0] ?? null;

    const pdf = await buildSolutionReportPdf({
      deal: {
        name: deal.name,
        company: deal.companyName,
        stage: deal.stage,
        amount: deal.amount,
        currency: deal.currency,
        industry: undefined,
      },
      call: latestCall
        ? {
            title: formatCallTitle(latestCall.call_type),
            date: latestCall.recorded_at,
            participants: (latestCall.call_speakers ?? [])
              .map((s) => s.name)
              .filter((n): n is string => Boolean(n)),
            totalCalls: calls.length,
          }
        : null,
      risk: risk
        ? {
            score: risk.risk_score,
            level: risk.risk_level,
            signals: risk.signals.map((s) => ({
              type: s.type,
              confidence: s.confidence,
              quote: s.quotes?.[0],
            })),
          }
        : null,
      solution: {
        salvageable: report.salvageable ?? report.overall.salvageable ?? "maybe",
        reasoning: report.overall.reasoning ?? "",
        recommendations: report.recommendations.map((r) => ({
          signal: r.signal,
          recommendation: r.recommendation,
          nextStep: r.nextStep,
        })),
        model: report.model,
        createdAt: report.created_at,
      },
    });

    const date = (report.created_at || new Date().toISOString()).split("T")[0];
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="findr-solution-${slug(
          deal.companyName || deal.name,
        )}-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(`[solution/pdf] failed for deal ${id}:`, err);
    return NextResponse.json(
      {
        error: "Failed to generate solution PDF",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
