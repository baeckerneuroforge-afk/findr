import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { disconnectGongIntegration } from "@/lib/gong/service";

export async function POST() {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  try {
    await disconnectGongIntegration(orgOrError.orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[integrations/gong/disconnect] failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}
