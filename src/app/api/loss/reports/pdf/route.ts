import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { generateQuarterlyReport } from "@/lib/loss/reports";

function dateParam(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function GET(req: NextRequest) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 90);

  const report = await generateQuarterlyReport(
    orgOrError.orgId,
    dateParam(req.nextUrl.searchParams.get("start"), defaultStart),
    dateParam(req.nextUrl.searchParams.get("end"), now),
  );

  return NextResponse.json({
    success: true,
    format: "json",
    note: "PDF generation is planned for phase 2; this endpoint returns report JSON for now.",
    report,
  });
}
