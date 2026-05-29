import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { AccountUpdateSchema, updateAccount } from "@/lib/accounts/service";

/** Update an account's master data (any subset of fields). Org-scoped. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { id } = await params;
  const rawBody = await request.json().catch(() => null);
  const parsed = AccountUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const account = await updateAccount(orgOrError.orgId, id, parsed.data);
  if (!account) {
    return NextResponse.json({ error: t("notFound.account") }, { status: 404 });
  }

  return NextResponse.json({ success: true, account });
}
