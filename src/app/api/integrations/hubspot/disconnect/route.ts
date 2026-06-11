import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { disconnectHubspotIntegration } from "@/lib/hubspot/service";

export async function POST() {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  try {
    await disconnectHubspotIntegration(orgOrError.orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : t("unexpected"),
      },
      { status: 500 },
    );
  }
}
