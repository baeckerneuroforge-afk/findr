import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { createAccountFromWonDeal } from "@/lib/accounts/service";

const FromDealSchema = z.object({
  dealId: z.string().min(1).max(200),
});

/** Create an account from a won deal (copies company + contact + amount). */
export async function POST(request: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = FromDealSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const account = await createAccountFromWonDeal(
      orgOrError.orgId,
      parsed.data.dealId,
    );
    if (!account) {
      return NextResponse.json(
        { error: t("deals.notWon") },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, account });
  } catch (err) {
    console.error("[accounts/from-deal] failed:", err);
    return NextResponse.json({ error: t("unexpected") }, { status: 500 });
  }
}
