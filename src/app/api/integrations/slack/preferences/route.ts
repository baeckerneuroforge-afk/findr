import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getSlackAlertPreferences,
  upsertSlackAlertPreferences,
} from "@/lib/alerts/service";
import { AlertPreferencesSchema } from "@/lib/alerts/types";

export async function GET() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const preferences = await getSlackAlertPreferences(orgOrError.orgId);
  return NextResponse.json({ success: true, preferences });
}

export async function PUT(req: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  try {
    const rawBody = await req.json();
    const parsed = AlertPreferencesSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: t("integrations.invalidAlertPreferences"),
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const preferences = await upsertSlackAlertPreferences(
      orgOrError.orgId,
      parsed.data,
    );
    return NextResponse.json({ success: true, preferences });
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
