import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { requireSettingsAdminOrError } from "@/lib/settings/server-auth";
import {
  getOrgBusinessContext,
  setOrgBusinessContext,
  OrgBusinessContextSchema,
} from "@/lib/settings/org-settings";

/**
 * Org-Profil-Kontext (E3) — GET liest den org-weiten Unternehmens-/Produkt-
 * Kontext (org-scoped: JEDES Mitglied braucht ihn für den Wizard-Prefill),
 * PUT schreibt ihn und ist SERVER-seitig admin-gated
 * (requireSettingsAdminOrError, wie die anderen Settings-Mutationen) — die UI
 * verspricht "Nur Admins", also muss die Route das auch erzwingen, nicht nur
 * das disabled-Attribut im Form.
 */

export async function GET() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const businessContext = await getOrgBusinessContext(orgOrError.orgId);
  return NextResponse.json({ success: true, businessContext });
}

export async function PUT(req: NextRequest) {
  const t = await getTranslations("errors");
  const adminOrError = await requireSettingsAdminOrError();
  if ("error" in adminOrError) return adminOrError.error;

  const rawBody = await req.json().catch(() => null);
  const parsed = OrgBusinessContextSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("settings.invalidSettings"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const businessContext = await setOrgBusinessContext(
      adminOrError.orgId,
      parsed.data,
    );
    return NextResponse.json({ success: true, businessContext });
  } catch (err) {
    console.error(
      "[settings/business-context] save failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("settings.couldNotSave") },
      { status: 500 },
    );
  }
}
