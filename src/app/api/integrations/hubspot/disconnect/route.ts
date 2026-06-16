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
    console.error("[integrations/hubspot/disconnect] failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}
