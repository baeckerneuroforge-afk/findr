import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getSolutionReports } from "@/lib/solution/service";

const DealIdSchema = z.string().uuid();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { dealId } = await params;
  const parsed = DealIdSchema.safeParse(dealId);
  if (!parsed.success) {
    return NextResponse.json({ error: t("solution.invalidDealId") }, { status: 400 });
  }

  const reports = await getSolutionReports(orgOrError.orgId, parsed.data);
  return NextResponse.json({ success: true, reports });
}
