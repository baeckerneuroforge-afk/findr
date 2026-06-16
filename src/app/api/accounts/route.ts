import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  AccountCreateSchema,
  createAccount,
  getAccounts,
} from "@/lib/accounts/service";

/** List all accounts for the org. */
export async function GET() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const accounts = await getAccounts(orgOrError.orgId);
  return NextResponse.json({ accounts });
}

/** Create an account manually. */
export async function POST(request: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = AccountCreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const account = await createAccount(orgOrError.orgId, parsed.data);
    return NextResponse.json({ success: true, account });
  } catch (err) {
    console.error("[accounts] create failed:", err);
    return NextResponse.json({ error: t("unexpected") }, { status: 500 });
  }
}
