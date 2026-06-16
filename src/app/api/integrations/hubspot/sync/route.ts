import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { syncHubspotDeals } from "@/lib/hubspot/service";

export async function POST() {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  try {
    const result = await syncHubspotDeals(orgOrError.orgId);
    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors.slice(0, 10),
    });
  } catch (err) {
    console.error("[integrations/hubspot/sync] failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}
