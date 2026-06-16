import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { ensureSlackAlertPreferences } from "@/lib/alerts/service";
import { upsertSlackIntegration } from "@/lib/slack/service";
import { SlackIntegrationConfigSchema } from "@/lib/schemas/slack";

export async function POST(req: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  try {
    const rawBody = await req.json();
    const parsed = SlackIntegrationConfigSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: t("integrations.invalidConfiguration"),
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    await upsertSlackIntegration(orgId, parsed.data);
    await ensureSlackAlertPreferences(orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[integrations/slack] failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}
