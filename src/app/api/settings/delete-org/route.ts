import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireSettingsAdminOrError } from "@/lib/settings/server-auth";
import { deleteOrganizationData } from "@/lib/settings/delete-org";
import { validateDeleteConfirmation } from "@/lib/settings/roles";

const DeleteOrgSchema = z.object({
  confirmationName: z.string().min(1),
});

export async function POST(request: Request) {
  const t = await getTranslations("errors");
  const admin = await requireSettingsAdminOrError();
  if ("error" in admin) return admin.error;

  const raw = await request.json().catch(() => null);
  const parsed = DeleteOrgSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: t("settings.invalidConfirmation") },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data: organization, error } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", admin.orgId)
    .single();

  if (error || !organization) {
    return NextResponse.json(
      { success: false, error: t("notFound.organization") },
      { status: 404 },
    );
  }

  // A confirmation-name mismatch is user input, not an internal failure: validate
  // it here and return a localized 400. The raw service Error ("Confirmation does
  // not match…") must never reach the client; the service still re-checks as a
  // safety net.
  if (
    !validateDeleteConfirmation(parsed.data.confirmationName, organization.name)
  ) {
    return NextResponse.json(
      { success: false, error: t("settings.invalidConfirmation") },
      { status: 400 },
    );
  }

  try {
    const result = await deleteOrganizationData({
      orgId: admin.orgId,
      clerkOrgId: admin.clerkOrgId,
      organizationName: organization.name,
      confirmationName: parsed.data.confirmationName,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[settings/delete-org] failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}
