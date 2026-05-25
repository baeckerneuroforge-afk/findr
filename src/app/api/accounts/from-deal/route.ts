import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { createAccountFromWonDeal } from "@/lib/accounts/service";

const FromDealSchema = z.object({
  dealId: z.string().min(1).max(200),
});

/** Create an account from a won deal (copies company + contact + amount). */
export async function POST(request: NextRequest) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = FromDealSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
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
        { error: "Deal not found or not marked won" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, account });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Could not create account",
      },
      { status: 500 },
    );
  }
}
