import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError, getOrgName } from "@/lib/auth/org";
import { generateQuarterlyReport } from "@/lib/loss/reports";
import { buildLossReportPdf } from "@/lib/pdf/generator";

function dateParam(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function GET(req: NextRequest) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 90);

  try {
    const report = await generateQuarterlyReport(
      orgId,
      dateParam(req.nextUrl.searchParams.get("start"), defaultStart),
      dateParam(req.nextUrl.searchParams.get("end"), now),
    );
    const orgName = await getOrgName(orgId);
    const pdf = await buildLossReportPdf(report, orgName);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="findr-loss-report-${report.period_start}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to generate loss-report PDF",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
