import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { analyzeAndPersistLossReason } from "@/lib/loss/service";

const ExtractLossSchema = z.object({
  dealId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const body = await req.json().catch(() => null);
  const parsed = ExtractLossSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await analyzeAndPersistLossReason(
    orgOrError.orgId,
    parsed.data.dealId,
  );
  if (!result) {
    return NextResponse.json(
      { error: t("loss.dealNotFoundOrSkipped") },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, analysis: result.analysis });
}
