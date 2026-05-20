import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  cacheLossReport,
  generateQuarterlyReport,
} from "@/lib/loss/reports";

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

  const start = dateParam(req.nextUrl.searchParams.get("start"), defaultStart);
  const end = dateParam(req.nextUrl.searchParams.get("end"), now);
  const report = await generateQuarterlyReport(orgOrError.orgId, start, end);

  if (req.nextUrl.searchParams.get("cache") === "true") {
    await cacheLossReport(orgOrError.orgId, report);
  }

  return NextResponse.json({ success: true, report });
}
