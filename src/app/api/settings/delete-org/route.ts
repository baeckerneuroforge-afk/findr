import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireSettingsAdminOrError } from "@/lib/settings/server-auth";
import { deleteOrganizationData } from "@/lib/settings/delete-org";

const DeleteOrgSchema = z.object({
  confirmationName: z.string().min(1),
});

export async function POST(request: Request) {
  const admin = await requireSettingsAdminOrError();
  if ("error" in admin) return admin.error;

  const raw = await request.json().catch(() => null);
  const parsed = DeleteOrgSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid confirmation" },
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
      { success: false, error: "Organization not found" },
      { status: 404 },
    );
  }

  try {
    const result = await deleteOrganizationData({
      orgId: admin.orgId,
      organizationName: organization.name,
      confirmationName: parsed.data.confirmationName,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Delete failed",
      },
      { status: 400 },
    );
  }
}
