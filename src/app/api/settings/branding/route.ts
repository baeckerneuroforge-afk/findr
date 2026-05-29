import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { requireSettingsAdminOrError } from "@/lib/settings/server-auth";
import {
  getOrgBranding,
  upsertOrgBranding,
  OrgBrandingSchema,
} from "@/lib/settings/org-settings";

/** Read / update white-label branding (brand name + accent color). Logo bytes
 * are handled separately by ./logo. Mirrors the general org settings route. */

export async function GET() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const branding = await getOrgBranding(orgOrError.orgId);
  return NextResponse.json({ success: true, branding });
}

export async function PUT(req: NextRequest) {
  const t = await getTranslations("errors");
  // Mutations are admin-only — gate before touching any data.
  const adminOrError = await requireSettingsAdminOrError();
  if ("error" in adminOrError) return adminOrError.error;

  const rawBody = await req.json().catch(() => null);
  const parsed = OrgBrandingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("settings.invalidSettings"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const branding = await upsertOrgBranding(adminOrError.orgId, parsed.data);
    return NextResponse.json({ success: true, branding });
  } catch (err) {
    console.error(
      "[settings/branding] save failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("settings.couldNotSave") },
      { status: 500 },
    );
  }
}
