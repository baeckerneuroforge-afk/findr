import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getOrgSettings,
  upsertOrgSettings,
  OrgSettingsSchema,
} from "@/lib/settings/org-settings";

/** Read / update general org settings (org-scoped). Mirrors the slack
 * preferences route (GET + PUT). */

export async function GET() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const settings = await getOrgSettings(orgOrError.orgId);
  return NextResponse.json({ success: true, settings });
}

export async function PUT(req: NextRequest) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const rawBody = await req.json().catch(() => null);
  const parsed = OrgSettingsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const settings = await upsertOrgSettings(orgOrError.orgId, parsed.data);
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error(
      "[settings/organization] save failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Could not save settings. Please try again." },
      { status: 500 },
    );
  }
}
