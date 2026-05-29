import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { DealContactSchema, updateDealContact } from "@/lib/deals/service";

/**
 * Set/replace a deal's contact details (name / email / phone). Org-scoped via
 * the logged-in session. Marking a deal won/lost lands in a later sprint and
 * will get its own endpoint — this one only touches the contact fields.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { id } = await params;
  const rawBody = await request.json().catch(() => null);
  const parsed = DealContactSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const deal = await updateDealContact(orgOrError.orgId, id, parsed.data);
  if (!deal) {
    return NextResponse.json({ error: t("notFound.deal") }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    contact: {
      contactName: deal.contactName ?? null,
      contactEmail: deal.contactEmail ?? null,
      contactPhone: deal.contactPhone ?? null,
    },
  });
}
